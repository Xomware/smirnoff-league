import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("opens a team window from Standings, once per team", async () => {
    renderDesktop();
    const standings = windowNamed("League Standings");
    const team6 = (await within(standings).findByText("Team 6")).closest("button")!;

    fireEvent.click(team6);
    fireEvent.click(tab("League Standings"));
    fireEvent.click(team6);

    const teamTabs = within(screen.getByRole("list", { name: "Open windows" })).getAllByRole("button", {
      name: "Team Profile",
    });
    expect(teamTabs).toHaveLength(1);
    expect(teamTabs[0].getAttribute("aria-pressed")).toBe("true");
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
