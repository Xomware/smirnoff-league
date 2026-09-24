import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Desktop } from "@/components/desktop/Desktop";
import { Taskbar } from "@/components/xp/Taskbar";
import { DrillContext } from "@/components/views/drill-link";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { SLOTS } from "@/lib/ices/compute";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { HomeWindow } from "./HomeWindow";
import { WatchWindow } from "./WatchWindow";

const league = "https://api.sleeper.app/v1/league/1394061072742227968";
const starters = SLOTS.map((_, i) => `s${i}`);

// Sunday afternoon of week 3: BUF@MIA is in the 3rd, DET@GB is over, KC is on bye.
const players = {
  ...Object.fromEntries(starters.map((id) => [id, { name: `Starter ${id}`, position: "RB", team: "MIA", injury_status: null }])),
  slow: { name: "Slow Quarterback", position: "QB", team: "BUF", injury_status: null },
  done: { name: "Done Receiver", position: "WR", team: "DET", injury_status: null },
  bye: { name: "Bye Tight End", position: "TE", team: "KC", injury_status: null },
};
const lineup = ["slow", "s1", "s2", "done", "s4", "bye", "s6", "s7", "s8", "s9"];
const matchups = [
  { roster_id: 1, matchup_id: 1, points: 60.4, starters: lineup, starters_points: [0.4, 10, 10, 0, 10, 0, 10, 10, 10, 10] },
  { roster_id: 2, matchup_id: 1, points: 100, starters, starters_points: SLOTS.map(() => 10) },
].map((m) => ({ ...m, custom_points: null, players: m.starters, players_points: null }));
const sunday = [
  espnEvent({ home: "MIA", away: "BUF", status: "STATUS_IN_PROGRESS", period: 3, clock: "4:12" }),
  espnEvent({ home: "GB", away: "DET", status: "STATUS_FINAL", period: 4 }),
];
// The Monday night game hasn't kicked off, so the bye tight end can still be benched.
const monnf = espnEvent({ home: "LAR", away: "SEA", date: "2026-09-29T00:15Z" });
let events = sunday;

beforeEach(() => {
  events = sunday;
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("espn.com")) return jsonResponse({ events });
    if (url === `${league}/matchups/3`) return jsonResponse(matchups);
    if (url === "/data/players.json") return jsonResponse(players);
    return sleeper(input, init);
  });
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const row = (team: HTMLElement, name: string) => within(team).getByText(name).closest("li")!;

describe("Ice Watch on a live Sunday", () => {
  it("shows WATCH, FINAL_ICE and LOCKED starters and balloons the one on watch", async () => {
    render(
      <AlertsProvider>
        <WatchWindow />
      </AlertsProvider>,
    );

    const team1 = await screen.findByRole("list", { name: "Team 1 starters on watch" });
    const watch = row(team1, "Slow Quarterback");
    const iced = row(team1, "Done Receiver");
    const locked = row(team1, "Bye Tight End");

    expect(watch.textContent).toMatch(/WATCH/);
    expect(watch.textContent).toMatch(/Q3 4:12/);
    expect(watch.classList).toContain("ice-watch");
    expect(iced.textContent).toMatch(/ICED/);
    expect(iced.textContent).toMatch(/FINAL/);
    expect(iced.classList).toContain("ice");
    expect(locked.textContent).toMatch(/LOCKED/);
    expect(locked.textContent).toMatch(/BYE/);
    expect(locked.classList).toContain("ice");

    const lists = screen.getAllByRole("list").map((l) => l.getAttribute("aria-label"));
    expect(lists[0]).toBe("Team 1 starters on watch");
    expect(within(team1).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/Done Receiver/),
      expect.stringMatching(/Slow Quarterback/),
      expect.stringMatching(/Bye Tight End/),
    ]);

    const balloon = await screen.findByRole("status", { name: /ice watch/i });
    expect(balloon.textContent).toMatch(/Slow Quarterback has 0.4 pts in the 3rd/);
  });
});

describe("Ice Watch, teams at risk first", () => {
  it("lists only teams with a starter at risk, then one closed line for everyone safe", async () => {
    render(
      <AlertsProvider>
        <WatchWindow />
      </AlertsProvider>,
    );

    await screen.findByRole("list", { name: "Team 1 starters on watch" });
    const rest = screen.getByText("Everyone else: all starters safe · 1 team").closest("details")!;
    expect(rest.open).toBe(false);
    expect(within(rest).getByRole("region", { name: "Team 2 ice watch", hidden: true })).toBeTruthy();
    expect(screen.queryByText("All starters safe.")).toBeNull();
    expect(screen.getByRole("region", { name: "Team 1 ice watch" }).closest("details")).toBeNull();
  });
});

describe("Ice Watch before the last kickoff", () => {
  it("tags the bye starter FIX LINEUP and leaves him out of the team's ices", async () => {
    events = [...sunday, monnf];
    render(
      <AlertsProvider>
        <WatchWindow />
      </AlertsProvider>,
    );

    const team1 = await screen.findByRole("list", { name: "Team 1 starters on watch" });
    const open = row(team1, "Bye Tight End");
    expect(within(open).getByText("FIX LINEUP").getAttribute("data-state")).toBe("OPEN");
    expect(open.textContent).not.toMatch(/LOCKED/);
    expect(open.classList).not.toContain("ice");
    expect(within(team1).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/Done Receiver/),
      expect.stringMatching(/Slow Quarterback/),
      expect.stringMatching(/Bye Tight End/),
    ]);
  });

  it("counts only the watch and final ices on Home", async () => {
    events = [...sunday, monnf];
    render(<HomeWindow />);
    const label = await screen.findByText("Ice Watch this week (live)");
    await vi.waitFor(() => expect(label.nextElementSibling?.textContent).toBe("2"));
  });
});

describe("Ice Watch drill-in", () => {
  it("opens each team's game", async () => {
    const onOpen = vi.fn();
    render(
      <AlertsProvider>
        <DrillContext.Provider value={onOpen}>
          <WatchWindow />
        </DrillContext.Provider>
      </AlertsProvider>,
    );

    fireEvent.click(await screen.findByText("Everyone else: all starters safe · 1 team"));
    const team = screen.getByRole("region", { name: "Team 2 ice watch" });
    fireEvent.click(within(team).getByRole("button", { name: "Open game" }));
    expect(onOpen).toHaveBeenCalledWith({ kind: "game", week: 3, matchup: 1 });
  });
});

describe("Home during live games", () => {
  it("counts locked, watch and final ices in the week's Ice Watch", async () => {
    render(<HomeWindow />);
    const label = await screen.findByText("Ice Watch this week (live)");
    await vi.waitFor(() => expect(label.nextElementSibling?.textContent).toBe("3"));
  });
});

describe("opening Ice Watch", () => {
  const renderDesktop = () =>
    render(
      <DesktopProvider>
        <Desktop />
        <Taskbar />
      </DesktopProvider>,
    );

  it("opens from the Ices folder on the desktop", async () => {
    renderDesktop();
    fireEvent.doubleClick(within(screen.getByRole("list", { name: "Desktop" })).getByRole("button", { name: "Ices" }));
    const folder = await screen.findByRole("region", { name: "Ices" });
    fireEvent.doubleClick(within(folder).getByRole("button", { name: "Ice Watch" }));
    expect(await screen.findByRole("region", { name: "Ice Watch" })).toBeTruthy();
  });

  it("opens from the Start menu's Ices submenu", async () => {
    renderDesktop();
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    fireEvent.click(screen.getByRole("button", { name: "Ices", expanded: false }));
    fireEvent.click(within(screen.getByRole("list", { name: "Ices" })).getByRole("button", { name: "Ice Watch" }));
    expect(await screen.findByRole("region", { name: "Ice Watch" })).toBeTruthy();
  });
});
