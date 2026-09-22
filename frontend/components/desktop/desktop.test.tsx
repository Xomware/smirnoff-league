import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/windows/ScoresWindow", () => ({
  ScoresWindow: () => {
    throw new Error("bad matchup row");
  },
}));

import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { Desktop } from "./Desktop";

function renderDesktop() {
  return render(
    <DesktopProvider>
      <Desktop />
      <Taskbar />
    </DesktopProvider>,
  );
}

// Hidden windows drop out of the accessibility tree, so find them by label.
const windowNamed = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!;
const tab = (name: string) => within(screen.getByRole("list", { name: "Open windows" })).getByRole("button", { name });

beforeEach(() => {
  stubSleeper();
  // jsdom has no pointer capture.
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  // The desktop mirrors its windows into ?open=, which the next render would reopen.
  window.history.replaceState(null, "", "/");
});

describe("DesktopWindow", () => {
  it("drags by the title bar and stays inside the viewport", () => {
    renderDesktop();
    const standings = windowNamed("League Standings");
    const bar = within(standings).getByRole("heading", { name: "League Standings" }).parentElement!;
    const { left, top } = standings.style;

    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 90, clientY: 120 });

    expect(parseFloat(standings.style.left)).toBe(parseFloat(left) - 10);
    expect(parseFloat(standings.style.top)).toBe(parseFloat(top) + 20);

    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 5000, clientY: 5000 });
    fireEvent.pointerUp(bar, { pointerId: 1 });

    // jsdom's viewport is 1024x768, less the 44px taskbar.
    expect(parseFloat(standings.style.left) + parseFloat(standings.style.width)).toBe(1024);
    expect(parseFloat(standings.style.top) + parseFloat(standings.style.height)).toBe(768 - 44);

    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: -5000, clientY: -5000 });
    expect(standings.style.left).toBe("0px");
    expect(standings.style.top).toBe("0px");
  });
});

describe("a window that crashes", () => {
  it("shows an error in that window and leaves the rest of the desktop up", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderDesktop();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Scores" }));

    expect(within(windowNamed("Scores")).getByRole("alert").textContent).toMatch(/hit an error/);
    expect(windowNamed("League Standings")).toBeTruthy();
    expect(tab("Scores").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("drill-down", () => {
  const sectionCount = () => document.querySelectorAll("section.xp-desktop-window").length;

  it("navigates the window in place on a plain click", async () => {
    renderDesktop();
    const before = sectionCount();
    const standings = windowNamed("League Standings");

    fireEvent.click((await within(standings).findByText("Team 6")).closest("button")!);

    expect(sectionCount()).toBe(before);
    expect(standings.getAttribute("aria-label")).toBe("Team Profile - Team 6");
    expect(within(standings).getByRole("heading", { name: "Team Profile - Team 6" })).toBeTruthy();
  });

  it("opens a new window on Ctrl-click or middle-click, once per team", async () => {
    renderDesktop();
    const standings = windowNamed("League Standings");
    const team6 = (await within(standings).findByText("Team 6")).closest("button")!;

    fireEvent.click(team6, { ctrlKey: true });
    fireEvent.click(tab("League Standings"));
    fireEvent(team6, new MouseEvent("auxclick", { bubbles: true, button: 1 }));

    expect(windowNamed("League Standings")).toBe(standings);
    const teamTabs = within(screen.getByRole("list", { name: "Open windows" })).getAllByRole("button", {
      name: "Team Profile - Team 6",
    });
    expect(teamTabs).toHaveLength(1);
    expect(teamTabs[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("goes back on Alt+Left in the focused window", async () => {
    renderDesktop();
    const standings = windowNamed("League Standings");
    fireEvent.click((await within(standings).findByText("Team 6")).closest("button")!);

    const handled = !fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true });

    expect(handled).toBe(true);
    expect(standings.getAttribute("aria-label")).toBe("League Standings");
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true });
    expect(standings.getAttribute("aria-label")).toBe("Team Profile - Team 6");
  });

  it("walks Standings to a team to a zeroed player, and Back twice returns to Standings", async () => {
    renderDesktop();
    const win = windowNamed("League Standings");

    fireEvent.click((await within(win).findByText("Team 6")).closest("button")!);
    const results = await within(win).findByRole("table", { name: "Weekly results" });
    fireEvent.click(within(results).getByRole("button", { name: /Romeo Doubs/ }));
    expect(await within(win).findByRole("heading", { name: "Romeo Doubs" })).toBeTruthy();
    expect(win.getAttribute("aria-label")).toBe("Romeo Doubs");

    const back = within(win).getByRole("button", { name: "Back" });
    const forward = within(win).getByRole("button", { name: "Forward" });
    expect(forward).toHaveProperty("disabled", true);
    fireEvent.click(back);
    expect(win.getAttribute("aria-label")).toBe("Team Profile - Team 6");
    fireEvent.click(back);

    expect(win.getAttribute("aria-label")).toBe("League Standings");
    expect(await within(win).findByText("Team 6")).toBeTruthy();
    expect(back).toHaveProperty("disabled", true);
    expect(forward).toHaveProperty("disabled", false);
  });
});

describe("shared league data", () => {
  it("fetches the league once for Standings and two Team windows, titled by team name", async () => {
    renderDesktop();
    const standings = windowNamed("League Standings");
    fireEvent.click((await within(standings).findByText("Team 6")).closest("button")!, { ctrlKey: true });
    fireEvent.click(within(standings).getByText("Team 9").closest("button")!, { ctrlKey: true });

    for (const name of ["Team Profile - Team 6", "Team Profile - Team 9"]) {
      await waitFor(() => expect(windowNamed(name)).toBeTruthy());
      expect(within(windowNamed(name)).getByRole("heading", { level: 2 }).textContent).toBe(name);
      expect(tab(name)).toBeTruthy();
    }
    await screen.findAllByRole("table", { name: "Weekly results" });
    const calls = (path: string) =>
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(path)).length;
    for (const path of ["/league/1394061072742227968", "/users", "/rosters", "/data/players.json"]) {
      expect(calls(path), path).toBe(1);
    }
  });
});

describe("Taskbar tabs", () => {
  it("minimizes the focused window and restores it on a second click", () => {
    renderDesktop();
    const home = windowNamed("Smirnoff Fantasy Football League");
    const homeTab = tab("Smirnoff Fantasy Football League");
    expect(homeTab.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(homeTab);
    expect(home.hidden).toBe(true);
    expect(homeTab.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(homeTab);
    expect(home.hidden).toBe(false);
    expect(homeTab.getAttribute("aria-pressed")).toBe("true");
  });

  it("focuses a background window instead of minimizing it", () => {
    renderDesktop();
    fireEvent.click(tab("League Standings"));

    expect(tab("League Standings").getAttribute("aria-pressed")).toBe("true");
    expect(tab("Smirnoff Fantasy Football League").getAttribute("aria-pressed")).toBe("false");
    expect(windowNamed("Smirnoff Fantasy Football League").hidden).toBe(false);
  });
});

describe("phone mode", () => {
  it("shows only the focused window, maximized, and tabs switch between them", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("max-width"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    renderDesktop();

    const home = windowNamed("Smirnoff Fantasy Football League");
    const standings = windowNamed("League Standings");
    expect(home.dataset.maximized).toBe("true");
    expect(home.hidden).toBe(false);
    expect(standings.hidden).toBe(true);

    fireEvent.click(tab("League Standings"));

    expect(standings.hidden).toBe(false);
    expect(standings.dataset.maximized).toBe("true");
    expect(home.hidden).toBe(true);
  });
});
