import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchupRow } from "@/lib/ices/compute";
import { clearLeagueCache } from "@/lib/league/cache";
import { espnEvent } from "@/lib/test/espn-mock";
import { ScoresWindow } from "./ScoresWindow";

const golden: { weeks: { week: number; matchups: MatchupRow[] }[] } =
  JSON.parse(
    readFileSync(join(__dirname, "../../../fixtures/ices-golden.json"), "utf8"),
  );
const week1 = golden.weeks.find((w) => w.week === 1)!.matchups;
const week2 = golden.weeks.find((w) => w.week === 2)!.matchups;

const rosterIds = week1.map((m) => m.roster_id);

// Odd rosters set a team name, even ones fall back to display_name.
const users = rosterIds.map((id) => ({
  user_id: `u${id}`,
  display_name: id % 2 ? `user${id}` : `Team ${id}`,
  avatar: null,
  metadata: id % 2 ? { team_name: `Team ${id}` } : null,
}));

const rosters = rosterIds.map((id) => ({
  roster_id: id,
  owner_id: `u${id}`,
  co_owners: null,
  starters: [],
  players: [],
  settings: { wins: 1, losses: 1, ties: 0, fpts: 200, fpts_decimal: 0 },
}));

const responses: Record<string, unknown> = {
  "/league/1394061072742227968": {
    league_id: "1394061072742227968",
    name: "Smirnoff League",
    season: "2026",
    status: "in_season",
    total_rosters: 14,
    roster_positions: [],
    settings: { playoff_week_start: 15, playoff_teams: 8 },
  },
  "/league/1394061072742227968/users": users,
  "/league/1394061072742227968/rosters": rosters,
  "/state/nfl": {
    week: 3,
    display_week: 3,
    season: "2026",
    season_type: "regular",
    leg: 3,
  },
  "/league/1394061072742227968/matchups/1": week1,
  // Shape of real W3 2026 data: roster 10 came back with starters null.
  "/league/1394061072742227968/matchups/3": [
    {
      roster_id: 10,
      matchup_id: 4,
      points: 0,
      custom_points: null,
      starters: null,
      starters_points: [],
      players: null,
      players_points: null,
    },
    {
      roster_id: 11,
      matchup_id: 4,
      points: 0,
      custom_points: null,
      starters: ["8121", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
      starters_points: Array(10).fill(0),
      players: null,
      players_points: null,
    },
  ],
  "/data/players.json": {
    "8121": {
      name: "Romeo Doubs",
      position: "WR",
      team: "GB",
      injury_status: null,
    },
  },
};

function stubFetch(overrides: Record<string, unknown> = {}) {
  const all = { ...responses, ...overrides };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url
        .replace("https://api.sleeper.app/v1", "")
        .replace("https://site.api.espn.com/apis/site/v2/sports/football/nfl", "");
      if (!(path in all)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(all[path]), { status: 200 });
    }),
  );
}

beforeEach(() => {
  clearLeagueCache();
  stubFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const badgeOf = (team: string) =>
  screen.getByText(team).closest(".xp-team")?.querySelector(".ice-badge");

describe("Scores window", () => {
  it("shows week 1's 171.54 vs 127.36 matchup with ice badges on the iced rosters", async () => {
    render(<ScoresWindow />);

    const picker = await screen.findByLabelText("Week");
    expect((picker as HTMLSelectElement).value).toBe("3");
    fireEvent.change(picker, { target: { value: "1" } });

    const card = (await screen.findByText("171.54")).closest("section")!;
    expect(within(card).getByText("127.36")).toBeTruthy();

    expect(badgeOf("Team 6")?.textContent).toContain("x2");
    for (const team of ["Team 2", "Team 8", "Team 12"]) {
      expect(badgeOf(team)?.textContent).toContain("x1");
    }
    expect(badgeOf("Team 1")).toBeFalsy();
  });

  it("badges only the ices from the week on screen, not the season", async () => {
    render(<ScoresWindow />);
    fireEvent.change(await screen.findByLabelText("Week"), {
      target: { value: "1" },
    });
    await screen.findByText("171.54");

    // Rosters 12 and 13 both owe for week 2 as well.
    expect(badgeOf("Team 12")?.textContent).toContain("x1");
    expect(badgeOf("Team 13")).toBeFalsy();
    expect(badgeOf("Team 6")?.textContent).toContain("ices this week");
  });

  it("expands a matchup to its starters, frosting the one who zeroed", async () => {
    render(<ScoresWindow />);
    fireEvent.change(await screen.findByLabelText("Week"), {
      target: { value: "1" },
    });

    const toggle = (await screen.findByText("91.46")).closest("button")!;
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Romeo Doubs").closest("li")?.classList).toContain(
      "ice",
    );
  });

  it("renders the live week when Sleeper has no lineup for a roster", async () => {
    render(<ScoresWindow />);

    const toggle = (await screen.findAllByText("0.00"))[0].closest("button")!;
    fireEvent.click(toggle);

    expect(
      await screen.findByText("Sleeper has no lineup for this team yet."),
    ).toBeTruthy();
    expect(document.querySelector(".ice-badge")).toBeNull();
  });

  // 2026 week 4: Thursday night kicks off 8:15pm ET on Oct 1.
  const week4 = {
    "/state/nfl": { week: 4, display_week: 4, season: "2026", season_type: "regular", leg: 4 },
    "/league/1394061072742227968/matchups/2": week2,
    "/league/1394061072742227968/matchups/4": [],
    "/scoreboard?seasontype=2&week=4": {
      events: [
        espnEvent({ home: "DAL", away: "NYG", date: "2026-10-02T00:15Z" }),
        espnEvent({ home: "KC", away: "BUF", date: "2026-10-04T17:00Z" }),
      ],
    },
  };

  it("opens on last week until Thursday night kicks off, and pages back a week at a time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T16:00Z"));
    stubFetch(week4);
    render(<ScoresWindow />);

    const picker = (await screen.findByLabelText("Week")) as HTMLSelectElement;
    expect(picker.value).toBe("3");
    expect(screen.getByRole("button", { name: "Next week" })).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(picker.value).toBe("2");
    await screen.findByText("82.10");
    expect(badgeOf("Team 13")?.textContent).toContain("x2");
    expect(badgeOf("Team 12")?.textContent).toContain("x1");
    expect(badgeOf("Team 6")).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(picker.value).toBe("1");
    expect(screen.getByRole("button", { name: "Previous week" })).toHaveProperty("disabled", true);
  });

  it("opens on the current week once Thursday night has kicked off", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T01:00Z"));
    stubFetch(week4);
    render(<ScoresWindow />);

    const picker = (await screen.findByLabelText("Week")) as HTMLSelectElement;
    expect(picker.value).toBe("4");
    expect(screen.getByRole("button", { name: "Next week" })).toHaveProperty("disabled", true);
  });
});
