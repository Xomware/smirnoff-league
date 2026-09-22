import { afterEach, describe, expect, it, vi } from "vitest";

import { getScoreboard, sleeperTeam } from "./espn";
import { espnEvent, jsonResponse } from "./test/espn-mock";

// ESPN's /teams abbreviations and Sleeper's players.json `team` values, both 2026-09-22.
const ESPN_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH",
];
const SLEEPER_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sleeperTeam", () => {
  it("maps every ESPN team onto a Sleeper team", () => {
    expect(ESPN_TEAMS.map(sleeperTeam).sort()).toEqual(SLEEPER_TEAMS);
  });

  it("renames Washington and passes the lookalikes through", () => {
    expect(sleeperTeam("WSH")).toBe("WAS");
    expect(sleeperTeam("JAX")).toBe("JAX");
    expect(sleeperTeam("LAR")).toBe("LAR");
    expect(sleeperTeam("LV")).toBe("LV");
  });
});

describe("getScoreboard", () => {
  it("asks for the regular-season week and keys games by Sleeper team", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        events: [espnEvent({ home: "WSH", away: "DAL", status: "STATUS_IN_PROGRESS", period: 3, clock: "4:12" })],
      }),
    );

    const [game] = await getScoreboard(3);

    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=3",
    );
    expect(game).toEqual({
      id: "DAL@WSH",
      kickoff: "2026-09-27T17:00Z",
      state: "in",
      status: "STATUS_IN_PROGRESS",
      period: 3,
      clock: "4:12",
      completed: false,
      teams: ["WAS", "DAL"],
    });
  });

  it("throws on a failed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 503));
    await expect(getScoreboard(3)).rejects.toThrow("ESPN scoreboard week 3: 503");
  });
});
