import { describe, expect, it } from "vitest";

import { golden } from "@/lib/test/league-mock";
import { seasonTally } from "./tally";

const inProgress = { week: 3, matchups: golden.weeks[0].matchups };
const tally = seasonTally([...golden.weeks, inProgress], 3);
const owedBy = (rosterId: number) => tally.owed.find((t) => t.rosterId === rosterId)!;

describe("seasonTally", () => {
  it("counts W1 and W2 per roster, most owed first", () => {
    expect(owedBy(6).byWeek).toEqual({ 1: 2 });
    expect(owedBy(2).byWeek).toEqual({ 1: 1 });
    expect(owedBy(8).byWeek).toEqual({ 1: 1 });
    expect(owedBy(12).byWeek).toEqual({ 1: 1, 2: 1 });
    expect(owedBy(13).byWeek).toEqual({ 2: 2 });
    expect(owedBy(1)).toMatchObject({ byWeek: {}, total: 0 });

    expect(tally.owed.map((t) => t.total).slice(0, 6)).toEqual([2, 2, 2, 1, 1, 0]);
    expect(tally.owed).toHaveLength(14);
  });

  it("sums only finished weeks, leaving the in-progress week as live", () => {
    expect(tally.owed.reduce((n, t) => n + t.total, 0)).toBe(8);
    expect(tally.weeks.map((w) => w.week)).toEqual([1, 2]);
    expect(tally.live?.week).toBe(3);
    expect(tally.live?.ices).toHaveLength(5);
  });

  it("breaks totals down by reason", () => {
    expect(owedBy(6).reasons).toEqual({ zero: 1, empty: 0, lowest: 1 });
    expect(owedBy(12).reasons).toEqual({ zero: 2, empty: 0, lowest: 0 });
    expect(owedBy(13).reasons).toEqual({ zero: 1, empty: 0, lowest: 1 });
  });

  it("names the player and slot behind each weekly ice", () => {
    const doubs = tally.weeks[0].ices.find((i) => i.playerId === "8121");
    expect(doubs).toMatchObject({ rosterId: 6, reason: "zero", slot: "WR", points: 0 });
  });

  it("has no live ices before the current week kicks off", () => {
    const unplayed = golden.weeks[0].matchups.map((m) => ({
      ...m,
      points: 0,
      starters_points: m.starters_points.map(() => 0),
    }));
    expect(seasonTally([...golden.weeks, { week: 3, matchups: unplayed }], 3).live).toBeNull();
  });
});
