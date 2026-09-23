import { describe, expect, it } from "vitest";

import { golden } from "@/lib/test/league-mock";
import { iceStandings, seasonGrid, sortRows, toggleSort } from "./standings";
import { seasonTally } from "./tally";

// Mirrors the mock league: roster N scored 200 - N points-for.
const pf = Object.fromEntries(golden.weeks[0].matchups.map((m) => [m.roster_id, 200 - m.roster_id]));
// Sleeper reports week 3 with no games played yet, as in the mock league.
const tally = seasonTally([...golden.weeks, { week: 3, matchups: [] }], 3);
const rows = iceStandings(tally, golden.weeks, pf, null);
const nameOf = (rosterId: number) => `Team ${String(rosterId).padStart(2, "0")}`;

describe("iceStandings", () => {
  it("ranks by total ices, breaking ties by fewest points-for", () => {
    expect(rows.slice(0, 5).map((r) => [r.rank, r.rosterId, r.total])).toEqual([
      [1, 13, 2],
      [2, 12, 2],
      [3, 6, 2],
      [4, 8, 1],
      [5, 2, 1],
    ]);
    expect(rows).toHaveLength(14);
    expect(rows.at(-1)!.total).toBe(0);
  });

  it("carries reasons, the current streak and the worst week", () => {
    const byId = Object.fromEntries(rows.map((r) => [r.rosterId, r]));
    expect(byId[6]).toMatchObject({ reasons: { zero: 1, empty: 0, lowest: 1 }, streak: 0, worst: { week: 1, count: 2 } });
    expect(byId[12]).toMatchObject({ streak: 2, worst: { week: 1, count: 1 } });
    expect(byId[13]).toMatchObject({ reasons: { zero: 1, empty: 0, lowest: 1 }, streak: 1, worst: { week: 2, count: 2 } });
    expect(byId[1]).toMatchObject({ total: 0, streak: 0, worst: null });
  });
});

describe("column sorting", () => {
  it("flips direction on the same column and starts a new column at its natural direction", () => {
    const byTotal = toggleSort({ key: "rank", dir: "asc" }, "total");
    expect(byTotal).toEqual({ key: "total", dir: "desc" });
    expect(toggleSort(byTotal, "total")).toEqual({ key: "total", dir: "asc" });
    expect(toggleSort(byTotal, "team")).toEqual({ key: "team", dir: "asc" });
    expect(toggleSort({ key: "team", dir: "asc" }, "team")).toEqual({ key: "team", dir: "desc" });
  });

  it("sorts by the chosen column and falls back to shame rank on ties", () => {
    expect(sortRows(rows, { key: "team", dir: "asc" }, nameOf).slice(0, 3).map((r) => r.rosterId)).toEqual([1, 2, 3]);
    expect(sortRows(rows, { key: "streak", dir: "desc" }, nameOf).slice(0, 2).map((r) => r.rosterId)).toEqual([12, 13]);
    expect(sortRows(rows, { key: "lowest", dir: "desc" }, nameOf).slice(0, 2).map((r) => r.rosterId)).toEqual([13, 6]);
    expect(sortRows(rows, { key: "total", dir: "asc" }, nameOf).at(-1)!.rosterId).toBe(6);
    expect(sortRows(rows, { key: "rank", dir: "desc" }, nameOf)[0].rank).toBe(14);
  });
});

describe("seasonGrid", () => {
  it("builds a cell per team per finished week with column totals", () => {
    const grid = seasonGrid([13, 12, 6, 1], tally);

    expect(grid.columns).toEqual([
      { week: 1, live: false },
      { week: 2, live: false },
      { week: 3, live: true },
    ]);
    expect(grid.rows).toEqual([
      { rosterId: 13, counts: [0, 2, 0] },
      { rosterId: 12, counts: [1, 1, 0] },
      { rosterId: 6, counts: [2, 0, 0] },
      { rosterId: 1, counts: [0, 0, 0] },
    ]);
    // Totals cover every roster, not just the rows passed in.
    expect(grid.totals).toEqual([5, 3, 0]);
  });

  it("counts only locked (empty-slot) ices in the live column", () => {
    const w1 = golden.weeks[0].matchups;
    // Week 3 replays W1's scores, zeros and all, with roster 3's QB slot empty.
    const live = w1.map((m) => (m.roster_id === 3 ? { ...m, starters: ["0", ...m.starters!.slice(1)] } : m));
    const grid = seasonGrid([6, 3], seasonTally([...golden.weeks, { week: 3, matchups: live }], 3));

    expect(grid.rows).toEqual([
      { rosterId: 6, counts: [2, 0, 0] },
      { rosterId: 3, counts: [0, 0, 1] },
    ]);
    expect(grid.totals).toEqual([5, 3, 1]);
  });
});
