import { describe, expect, it } from "vitest";

import type { StatsMatchup } from "@/lib/ices/stats";
import { golden } from "@/lib/test/league-mock";
import { playerWeeks, teamResults, weekSummary } from "./drill";

// Fills the rest of a ten-slot lineup with 10-point starters and adds one 4-point bench player.
const lineup = (rosterId: number, points: number, starters: [string, number][]): StatsMatchup => {
  const fill = Array.from({ length: 10 - starters.length }, (_, i): [string, number] => [`p${rosterId}-${i}`, 10]);
  const full = [...starters, ...fill];
  const bench = `bench${rosterId}`;
  return {
    roster_id: rosterId,
    matchup_id: 1,
    points,
    starters: full.map(([id]) => id),
    starters_points: full.map(([, p]) => p),
    players: [...full.map(([id]) => id), bench],
    players_points: Object.fromEntries([...full, [bench, 4]]),
  };
};

describe("teamResults", () => {
  it("lists roster 6's weeks with opponent, W/L and that week's ices", () => {
    const rows = teamResults(golden.weeks, 6);
    expect(rows.map((r) => [r.week, r.opponent?.rosterId, r.points, r.opponent?.points, r.result])).toEqual([
      [1, 9, 91.46, 134.46, "L"],
      [2, 1, 114.98, 182.68, "L"],
    ]);
    expect(rows.map((r) => r.matchupId)).toEqual([7, 7]);
    expect(rows[0].ices.map((i) => i.id)).toEqual(["W01#R06#LOWEST", "W01#R06#S4"]);
    expect(rows[1].ices).toEqual([]);
  });
});

describe("playerWeeks", () => {
  it("follows a traded player across rosters and marks each ice", () => {
    const weeks = [
      { week: 1, matchups: [lineup(3, 80, [["x", 0]]), lineup(5, 120, [])] },
      { week: 2, matchups: [lineup(3, 130, []), lineup(5, 90, [["x", -1]])] },
    ];
    expect(playerWeeks(weeks, "x").map((w) => [w.week, w.rosterId, w.points, w.ice?.id ?? null])).toEqual([
      [1, 3, 0, "W01#R03#S0"],
      [2, 5, -1, "W02#R05#S0"],
    ]);
    expect(playerWeeks(weeks, "bench3")).toEqual([
      { week: 1, rosterId: 3, points: 4, started: false, ice: null },
      { week: 2, rosterId: 3, points: 4, started: false, ice: null },
    ]);
  });

  it("finds Romeo Doubs' W1 ice for roster 6", () => {
    const doubs = playerWeeks(golden.weeks, "8121");
    expect(doubs.map((w) => [w.week, w.rosterId, w.points, w.ice?.id ?? null])).toEqual([
      [1, 6, 0, "W01#R06#S4"],
      [2, 6, 12.6, null],
    ]);
  });
});

describe("weekSummary", () => {
  it("pairs week 1 matchups, groups ices by team and names the lowest", () => {
    const w1 = weekSummary(1, golden.weeks[0].matchups, false);
    expect(w1.pairs).toHaveLength(7);
    expect(w1.pairs[0].map((m) => m.matchup_id)).toEqual([1, 1]);
    expect(w1.icesByRoster.map(([rosterId, ices]) => [rosterId, ices.length])).toEqual([
      [2, 1],
      [6, 2],
      [8, 1],
      [12, 1],
    ]);
    expect(w1.lowest).toEqual({ rosterIds: [6], points: 91.46 });
  });

  it("keeps only locked ices for the live week", () => {
    const live = [lineup(3, 50, [["x", 0], ["0", 0]]), lineup(5, 60, [])];
    const summary = weekSummary(3, live, true);
    expect(summary.icesByRoster.map(([rosterId, ices]) => [rosterId, ices.map((i) => i.reason)])).toEqual([
      [3, ["empty"]],
    ]);
  });

  it("has no lowest team before any matchups exist", () => {
    expect(weekSummary(3, [], true)).toEqual({ pairs: [], icesByRoster: [], lowest: null });
  });
});
