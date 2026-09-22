import { vi } from "vitest";

const ids = Array.from({ length: 14 }, (_, i) => i + 1);

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
  "/league/1394061072742227968/users": ids.map((id) => ({
    user_id: `u${id}`,
    display_name: `user${id}`,
    avatar: null,
    metadata: { team_name: `Team ${id}` },
  })),
  "/league/1394061072742227968/rosters": ids.map((id) => ({
    roster_id: id,
    owner_id: `u${id}`,
    co_owners: null,
    starters: [],
    players: [],
    settings: { wins: id % 3, losses: 2 - (id % 3), ties: 0, fpts: 200 + id, fpts_decimal: 0 },
  })),
  "/state/nfl": { week: 3, display_week: 3, season: "2026", season_type: "regular", leg: 3 },
  "/data/players.json": {},
};

// Stubs the network edge (Sleeper and players.json) with a 14-team league, "Team 1".."Team 14".
export function stubSleeper() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input).replace("https://api.sleeper.app/v1", "");
    if (!(path in responses)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(responses[path]), { status: 200 });
  });
}
