import { describe, expect, it } from "vitest";

import type { SleeperRoster } from "@/lib/sleeper/types";
import { dangerZone, sortStandings } from "./standings";

function roster(
  roster_id: number,
  wins: number,
  losses: number,
  ties = 0,
  fpts = 100,
  fpts_decimal = 0,
): SleeperRoster {
  return {
    roster_id,
    owner_id: null,
    co_owners: null,
    starters: [],
    players: null,
    settings: { wins, losses, ties, fpts, fpts_decimal },
  };
}

const ids = (rows: { rosterId: number }[]) => rows.map((r) => r.rosterId);

describe("sortStandings", () => {
  it("sorts by wins first", () => {
    expect(ids(sortStandings([roster(1, 1, 2), roster(2, 3, 0), roster(3, 2, 1)]))).toEqual([2, 3, 1]);
  });

  it("breaks equal wins on ties", () => {
    expect(ids(sortStandings([roster(1, 1, 2, 0), roster(2, 1, 1, 1)]))).toEqual([2, 1]);
  });

  it("breaks equal records on points-for, including the decimal", () => {
    const rows = sortStandings([
      roster(1, 2, 1, 0, 300, 5),
      roster(2, 2, 1, 0, 300, 50),
      roster(3, 2, 1, 0, 299, 99),
    ]);
    expect(ids(rows)).toEqual([2, 1, 3]);
    expect(rows[0].pf).toBe(300.5);
  });

  it("treats a missing fpts_decimal as zero", () => {
    const r = roster(1, 0, 0);
    delete r.settings.fpts_decimal;
    expect(sortStandings([r])[0].pf).toBe(100);
  });
});

// 14 teams, wins listed in rank order, so roster id == rank.
function table(wins: number[]) {
  return sortStandings(wins.map((w, i) => roster(i + 1, w, 10 - w, 0, 1000 - i)));
}

describe("dangerZone", () => {
  // 8th has 5 wins, 9th has 4.
  const rows = table([9, 8, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3, 2, 1]);

  it("flags teams within one game above and below the 8/9 cut", () => {
    expect([...dangerZone(rows, 8)].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
  });

  it("leaves teams more than a game clear of the cut on either side", () => {
    const zone = dangerZone(rows, 8);
    expect(zone.has(5)).toBe(false);
    expect(zone.has(11)).toBe(false);
  });

  it("is empty when the 8th seed is more than a game ahead of the 9th", () => {
    expect(dangerZone(table([10, 10, 9, 9, 9, 8, 8, 8, 5, 5, 4, 3, 2, 1]), 8).size).toBe(0);
  });

  it("counts a tie as half a game", () => {
    const tied = sortStandings([
      ...Array.from({ length: 7 }, (_, i) => roster(i + 1, 9, 1)),
      roster(8, 5, 5),
      roster(9, 4, 6),
      roster(10, 3, 5, 2),
    ]);
    expect(dangerZone(tied, 8).has(10)).toBe(true);
  });
});
