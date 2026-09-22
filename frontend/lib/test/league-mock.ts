import { readFileSync } from "node:fs";
import { join } from "node:path";

import { vi } from "vitest";

import type { StatsMatchup } from "@/lib/ices/stats";

export const golden: { weeks: { week: number; matchups: StatsMatchup[] }[] } = JSON.parse(
  readFileSync(join(__dirname, "../../../fixtures/ices-golden.json"), "utf8"),
);

// Positions from Sleeper's players.json for the W1 bench players (points > 0)
// behind each zero ice, plus the zeroed starters. players.json isn't in git.
export const W1_POSITIONS: Record<string, string> = {
  "7553": "TE", "12545": "QB", "5022": "TE", "5872": "WR", "8180": "WR",
  "8121": "WR", "4147": "RB", "9504": "WR",
  "12517": "TE", "11586": "RB", "13285": "WR", "3163": "QB", "9482": "TE",
  "11576": "RB", "421": "QB",
};

const league = "/league/1394061072742227968";
const rosterIds = golden.weeks[0].matchups.map((m) => m.roster_id);

// Golden weeks 1-2 are finished and Sleeper reports week 3, not yet kicked off.
const responses: Record<string, unknown> = {
  [league]: {
    league_id: "1394061072742227968",
    name: "Smirnoff League",
    season: "2026",
    status: "in_season",
    total_rosters: 14,
    roster_positions: [],
    settings: { playoff_week_start: 15, playoff_teams: 8 },
  },
  [`${league}/users`]: rosterIds.map((id) => ({
    user_id: `u${id}`,
    display_name: `user${id}`,
    avatar: null,
    metadata: { team_name: `Team ${id}` },
  })),
  [`${league}/rosters`]: rosterIds.map((id) => ({
    roster_id: id,
    owner_id: `u${id}`,
    co_owners: null,
    starters: [],
    players: [],
    settings: { wins: 1, losses: 1, ties: 0, fpts: 200 - id, fpts_decimal: 0 },
  })),
  "/state/nfl": { week: 3, display_week: 3, season: "2026", season_type: "regular", leg: 3 },
  ...Object.fromEntries(golden.weeks.map((w) => [`${league}/matchups/${w.week}`, w.matchups])),
  [`${league}/matchups/3`]: [],
  "/data/players.json": {
    ...Object.fromEntries(
      Object.entries(W1_POSITIONS).map(([id, position]) => [
        id,
        { name: `Player ${id}`, position, team: null, injury_status: null },
      ]),
    ),
    "8121": { name: "Romeo Doubs", position: "WR", team: "GB", injury_status: null },
  },
};

// A spy rather than vi.stubGlobal: unstubAllGlobals would also drop the
// IntersectionObserver stub from vitest.setup.ts that next/link needs.
export function stubSleeper() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input).replace("https://api.sleeper.app/v1", "");
    if (!(path in responses)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(responses[path]), { status: 200 });
  });
}
