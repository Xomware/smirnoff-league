import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchupRow } from "@/lib/ices/compute";
import ScoresPage from "./page";

const golden: { weeks: { week: number; matchups: MatchupRow[] }[] } =
  JSON.parse(
    readFileSync(join(__dirname, "../../../fixtures/ices-golden.json"), "utf8"),
  );
const week1 = golden.weeks.find((w) => w.week === 1)!.matchups;

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace("https://api.sleeper.app/v1", "");
      if (!(path in responses))
        return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(responses[path]), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const badgeOf = (team: string) =>
  screen.getByText(team).closest(".xp-team")?.querySelector(".ice-badge");

describe("Scores page", () => {
  it("shows week 1's 171.54 vs 127.36 matchup with ice badges on the iced rosters", async () => {
    render(<ScoresPage />);

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

  it("expands a matchup to its starters, frosting the one who zeroed", async () => {
    render(<ScoresPage />);
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
    render(<ScoresPage />);

    const toggle = (await screen.findAllByText("0.00"))[0].closest("button")!;
    fireEvent.click(toggle);

    expect(
      await screen.findByText("Sleeper has no lineup for this team yet."),
    ).toBeTruthy();
    expect(document.querySelector(".ice-badge")).toBeNull();
  });
});
