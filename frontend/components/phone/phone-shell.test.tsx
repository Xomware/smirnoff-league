import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { AppShell } from "./AppShell";

interface Screen {
  width: number;
  height: number;
  coarse: boolean;
}

const PORTRAIT: Screen = { width: 390, height: 844, coarse: true };
const LANDSCAPE: Screen = { width: 844, height: 390, coarse: true };
const DESKTOP: Screen = { width: 1440, height: 900, coarse: false };

let screenNow = PORTRAIT;
const listeners = new Set<() => void>();

// A tiny media query engine for the features the app queries, so the tests
// exercise the real PHONE query string rather than an echo of it.
function evaluate(query: string, s: Screen): boolean {
  return query.split(",").some((q) =>
    q
      .trim()
      .split(/\s+and\s+/)
      .every((feature) => {
        const [, name, value] = feature.match(/^\(([\w-]+):\s*([\w.]+?)(?:px)?\)$/) ?? [];
        if (name === "max-width") return s.width <= Number(value);
        if (name === "max-height") return s.height <= Number(value);
        if (name === "pointer") return (s.coarse ? "coarse" : "fine") === value;
        if (name === "prefers-reduced-motion") return false;
        throw new Error(`Unhandled media feature: ${feature}`);
      }),
  );
}

function viewport(s: Screen) {
  screenNow = s;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return evaluate(query, screenNow);
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }) as unknown as MediaQueryList,
  );
}

function rotate(s: Screen) {
  act(() => {
    screenNow = s;
    listeners.forEach((fn) => fn());
  });
}

function renderShell() {
  return render(
    <DesktopProvider>
      <AppShell />
    </DesktopProvider>,
  );
}

const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const tabBar = () => within(screen.getByRole("navigation", { name: "Tabs" }));
const tab = (name: string) => tabBar().getByRole("button", { name });
const sheet = () => screen.getByRole("navigation", { name: "Start menu" });
const back = () => screen.getByRole("button", { name: "Back" });
// Screens under the top one stay mounted but hidden, so query the visible one.
const top = () => within(document.querySelector<HTMLElement>(".phone-screen:not([hidden])")!);
const drillTo = async (pattern: RegExp) => {
  const links = await waitFor(() => {
    const found = top()
      .getAllByRole("button")
      .filter((b) => b.classList.contains("xp-drill") && pattern.test(b.textContent ?? ""));
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  const text = links[0].textContent!;
  fireEvent.click(links[0]);
  return text;
};

beforeEach(() => {
  stubSleeper();
  viewport(PORTRAIT);
});
afterEach(() => {
  vi.restoreAllMocks();
  listeners.clear();
  window.history.replaceState(null, "", "/");
});

describe("AppShell", () => {
  it("renders the phone shell instead of the desktop when the phone query matches", () => {
    renderShell();
    expect(document.querySelector(".xp-desktop")).toBeNull();
    expect(tab("Home").getAttribute("aria-current")).toBe("page");
    expect(title()).toBe("Smirnoff Fantasy Football League");
  });

  it("renders the desktop and its taskbar otherwise", () => {
    viewport(DESKTOP);
    renderShell();
    expect(document.querySelector(".xp-desktop")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "Tabs" })).toBeNull();
    expect(screen.getByRole("list", { name: "Open windows" })).toBeTruthy();
  });
});

describe("shell choice", () => {
  it.each([
    ["a portrait phone", true, PORTRAIT],
    ["a landscape phone", true, LANDSCAPE],
    ["a large landscape phone", true, { width: 932, height: 430, coarse: true }],
    ["a narrow desktop window", true, { width: 600, height: 900, coarse: false }],
    ["a short desktop window with a mouse", false, { width: 1280, height: 420, coarse: false }],
    ["a landscape tablet", false, { width: 1024, height: 768, coarse: true }],
    ["a portrait tablet", false, { width: 768, height: 1024, coarse: true }],
    ["a desktop", false, DESKTOP],
  ])("%s: phone shell %s", (_, phone, s) => {
    viewport(s);
    renderShell();
    expect(screen.queryByRole("navigation", { name: "Tabs" }) !== null).toBe(phone);
    expect(document.querySelector(".xp-desktop") !== null).toBe(!phone);
  });

  it("keeps the screen and every tab's stack when the phone rotates", async () => {
    renderShell();
    fireEvent.click(tab("Standings"));
    const team = (await drillTo(/Team \d+/)).match(/Team \d+/)![0];
    fireEvent.click(tab("Scores"));
    await waitFor(() => expect(title()).toBe("Scores"));
    const scores = document.querySelector(".phone-screen:not([hidden])");

    rotate(LANDSCAPE);

    expect(title()).toBe("Scores");
    expect(document.querySelector(".phone-screen:not([hidden])")).toBe(scores);
    fireEvent.click(tab("Standings"));
    await waitFor(() => expect(title()).toBe(`Team Profile - ${team}`));

    rotate(PORTRAIT);

    expect(title()).toBe(`Team Profile - ${team}`);
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("League Standings"));
  });
});

describe("phone stack", () => {
  it("pushes a drilled screen, and Back pops it through history", async () => {
    renderShell();
    fireEvent.click(tab("Standings"));
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    const team = (await drillTo(/Team \d+/)).match(/Team \d+/)![0];

    expect(title()).toBe(`Team Profile - ${team}`);
    expect(window.location.search).toMatch(/^\?open=standings,team:\d+$/);
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("League Standings"));
    expect(window.location.search).toBe("?open=standings");
  });

  it("pops on the browser's own back", async () => {
    renderShell();
    fireEvent.click(tab("Standings"));
    await drillTo(/Team \d+/);

    window.history.back();

    await waitFor(() => expect(title()).toBe("League Standings"));
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("keeps each tab's stack, and tapping the current tab returns to its root", async () => {
    renderShell();
    fireEvent.click(tab("Standings"));
    const team = (await drillTo(/Team \d+/)).match(/Team \d+/)![0];
    fireEvent.click(tab("Scores"));
    await waitFor(() => expect(title()).toBe("Scores"));

    fireEvent.click(tab("Standings"));
    await waitFor(() => expect(title()).toBe(`Team Profile - ${team}`));
    expect(tab("Standings").getAttribute("aria-current")).toBe("page");

    fireEvent.click(tab("Standings"));
    await waitFor(() => expect(title()).toBe("League Standings"));
  });

  it("opens a deep link as a stack with the last item on top", async () => {
    window.history.replaceState(null, "", "/?open=scores,team:3");
    renderShell();

    expect(tab("Scores").getAttribute("aria-current")).toBe("page");
    await waitFor(() => expect(title()).toBe("Team Profile - Team 3"));
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Scores"));
  });

  it("opens Start sheet items on the current tab and closes on Escape", async () => {
    renderShell();
    const start = tabBar().getByRole("button", { name: "start" });
    fireEvent.click(start);
    expect(within(sheet()).getByRole("button", { name: "Sign out" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Start menu" })).toBeNull();
    expect(document.activeElement).toBe(start);

    fireEvent.click(start);
    fireEvent.click(within(sheet()).getByRole("button", { name: "Brackets" }));
    expect(screen.queryByRole("navigation", { name: "Start menu" })).toBeNull();
    expect(title()).toBe("Brackets");
    expect(tab("Home").getAttribute("aria-current")).toBe("page");
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Smirnoff Fantasy Football League"));
  });
});

describe("at 390px", () => {
  it("Home, Scores, a matchup, a team, a player, Back twice lands on Scores with the matchup still open", async () => {
    renderShell();
    expect(title()).toBe("Smirnoff Fantasy Football League");

    fireEvent.click(tab("Scores"));
    fireEvent.change(await top().findByRole("combobox"), { target: { value: "1" } });
    const toggle = within(await top().findByRole("region", { name: "Matchup 1" })).getByRole("button", { expanded: false });
    fireEvent.click(toggle);

    const team = (await drillTo(/Team \d+/)).match(/Team \d+/)![0];
    expect(title()).toBe(`Team Profile - ${team}`);
    fireEvent.click(await top().findByRole("tab", { name: "Roster" }));
    const starters = await top().findByRole("region", { name: "Starters" });
    fireEvent.click(within(starters).getAllByRole("button")[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toBeTruthy());
    expect(window.location.search).toMatch(/^\?open=scores,team:\d+,player:\w+$/);

    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe(`Team Profile - ${team}`));
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Scores"));

    expect(tab("Scores").getAttribute("aria-current")).toBe("page");
    expect(top().getByRole("region", { name: "Matchup 1" })).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
