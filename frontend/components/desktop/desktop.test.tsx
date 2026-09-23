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
// League Standings is off the default layout, so the tests that drill from it open it first.
const openStandings = () => {
  fireEvent.doubleClick(screen.getByRole("button", { name: "Standings" }));
  return windowNamed("League Standings");
};

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
    const standings = openStandings();
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
    expect(windowNamed("Ice Standings")).toBeTruthy();
    expect(tab("Scores").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("drill-down", () => {
  const sectionCount = () => document.querySelectorAll("section.xp-desktop-window").length;

  it("navigates the window in place on a plain click", async () => {
    renderDesktop();
    const standings = openStandings();
    const before = sectionCount();

    fireEvent.click((await within(standings).findByText("Team 6")).closest("button")!);

    expect(sectionCount()).toBe(before);
    expect(standings.getAttribute("aria-label")).toBe("Team Profile - Team 6");
    expect(within(standings).getByRole("heading", { name: "Team Profile - Team 6" })).toBeTruthy();
  });

  it("opens a new window on Ctrl-click or middle-click, once per team", async () => {
    renderDesktop();
    const standings = openStandings();
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
    const standings = openStandings();
    fireEvent.click((await within(standings).findByText("Team 6")).closest("button")!);

    const handled = !fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true });

    expect(handled).toBe(true);
    expect(standings.getAttribute("aria-label")).toBe("League Standings");
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true });
    expect(standings.getAttribute("aria-label")).toBe("Team Profile - Team 6");
  });

  it("walks Standings to a team to a zeroed player, and Back twice returns to Standings", async () => {
    renderDesktop();
    const win = openStandings();

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
    const standings = openStandings();
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
    fireEvent.click(tab("Ice Standings"));

    expect(tab("Ice Standings").getAttribute("aria-pressed")).toBe("true");
    expect(tab("Smirnoff Fantasy Football League").getAttribute("aria-pressed")).toBe("false");
    expect(windowNamed("Smirnoff Fantasy Football League").hidden).toBe(false);
  });
});

describe("Start menu", () => {
  it("cascades the five ice apps under Ices and opens one", () => {
    renderDesktop();
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    const menu = within(screen.getByRole("navigation", { name: "Start menu" }));
    expect(menu.queryByRole("button", { name: "Ice Stats" })).toBeNull();

    const ices = menu.getByRole("button", { name: "Ices" });
    fireEvent.pointerEnter(ices.parentElement!, { pointerType: "mouse" });
    expect(ices.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerLeave(ices.parentElement!, { pointerType: "mouse" });
    expect(ices.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(ices);
    const submenu = within(menu.getByRole("list", { name: "Ices" }));
    expect(submenu.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Ice Ledger",
      "Ice Standings",
      "Ice Stats",
      "Ice Watch",
      "Chug Videos",
    ]);
    fireEvent.click(submenu.getByRole("button", { name: "Ice Stats" }));

    expect(screen.queryByRole("navigation", { name: "Start menu" })).toBeNull();
    expect(tab("Ice Stats").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("desktop icons", () => {
  it("files the ice apps in the Ices folder and keeps the rest on the desktop", () => {
    renderDesktop();
    const icons = within(screen.getByRole("list", { name: "Desktop" }));
    const names = icons.getAllByRole("button").map((b) => b.textContent);

    expect(names).toEqual(expect.arrayContaining(["Ices", "Scores", "Standings", "Brackets", "League News", "News Drop", "My Team"]));
    for (const app of ["Ice Ledger", "Ice Standings", "Ice Stats", "Ice Watch", "Chug Videos"]) expect(names).not.toContain(app);
  });
});
