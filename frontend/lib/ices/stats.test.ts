import { describe, expect, it } from "vitest";

import { golden, W1_POSITIONS } from "@/lib/test/league-mock";
import { avoidableIces, closestEscapes, iceStats, iceStreaks, repeatOffenders, type StatsMatchup } from "./stats";

const w1Position = (id: string) => W1_POSITIONS[id];

const row = (rosterId: number, starters: string[], startersPoints: number[], bench: Record<string, number> = {}): StatsMatchup => ({
  roster_id: rosterId,
  matchup_id: 1,
  points: 100 + rosterId,
  starters,
  starters_points: startersPoints,
  players: [...starters, ...Object.keys(bench)],
  players_points: bench,
});

const FULL = ["qb", "rb1", "rb2", "wr1", "wr2", "te", "fx1", "fx2", "k", "DAL"];
const ok = FULL.map(() => 10);
const lineup = (overrides: Record<number, [string, number]>) => {
  const starters = [...FULL];
  const points = [...ok];
  for (const [i, [id, p]] of Object.entries(overrides)) {
    starters[Number(i)] = id;
    points[Number(i)] = p;
  }
  return { starters, points };
};
const positions: Record<string, string> = { rb: "RB", wr: "WR", te: "TE", qb: "QB", k: "K" };
const iced = (rosterId: number, overrides: Record<number, [string, number]>, bench: Record<string, number> = {}) => {
  const { starters, points } = lineup(overrides);
  return row(rosterId, starters, points, bench);
};
const synthPosition = (id: string) => positions[id.replace(/\d+$/, "").replace(/^b/, "")];

// Roster 99 is the weekly lowest in every synthetic week, so it absorbs the
// `lowest` ices and leaves rosters 1-3 with only the ices a test sets up.
const week = (n: number, rows: StatsMatchup[]) => ({
  week: n,
  matchups: [...rows, { ...row(99, FULL, ok), points: 1 }],
});
const clean = (rosterId: number) => row(rosterId, FULL, ok);

describe("iceStats on the golden W1/W2 weeks", () => {
  const stats = iceStats(golden.weeks, w1Position);

  it("counts ices by week and by reason", () => {
    expect(stats.byWeek).toEqual([
      { week: 1, count: 5 },
      { week: 2, count: 3 },
    ]);
    expect(stats.byReason).toEqual({ zero: 6, lowest: 2, empty: 0 });
  });

  it("finds the W1 zeros a bench player could have covered", () => {
    // R12's DEF zeroed with no DEF on the bench, so it isn't avoidable.
    const w1 = avoidableIces([golden.weeks[0]], w1Position);
    expect(w1.map((a) => [a.ice.rosterId, a.ice.playerId, a.playerId, a.points])).toEqual([
      [2, "7553", "5022", 23.7],
      [8, "12517", "9482", 9.2],
      [6, "8121", "9504", 3.1],
    ]);
  });

  it("has no repeat offenders in two weeks", () => {
    expect(stats.repeatOffenders).toEqual([]);
  });
});

describe("repeatOffenders", () => {
  it("lists players with two or more zero ices across weeks and rosters", () => {
    const weeks = [
      week(1, [iced(1, { 3: ["wr9", 0] }), clean(2)]),
      week(2, [iced(2, { 4: ["wr9", -1] }), clean(1)]),
      week(3, [iced(1, { 0: ["qb7", 0] }), clean(2)]),
    ];
    expect(repeatOffenders(weeks)).toEqual([{ playerId: "wr9", count: 2, weeks: [1, 2], rosterIds: [1, 2] }]);
  });
});

describe("avoidableIces", () => {
  const zeroAt = (slot: number, id: string, bench: Record<string, number>) => [week(1, [iced(1, { [slot]: [id, 0] }, bench)])];

  it("lets FLEX take the best RB, WR or TE but never a QB or K", () => {
    const [a] = avoidableIces(zeroAt(6, "rb9", { bqb1: 40, bk1: 30, bte1: 4, bwr1: 7, brb1: 6 }), synthPosition);
    expect(a).toMatchObject({ playerId: "bwr1", points: 7 });
    expect(avoidableIces(zeroAt(6, "rb9", { bqb1: 40, bk1: 30 }), synthPosition)).toEqual([]);
  });

  it("matches other slots exactly", () => {
    expect(avoidableIces(zeroAt(1, "rb9", { bwr1: 20, bte1: 20 }), synthPosition)).toEqual([]);
    expect(avoidableIces(zeroAt(1, "rb9", { bwr1: 20, brb1: 2 }), synthPosition)).toEqual([
      expect.objectContaining({ playerId: "brb1", points: 2 }),
    ]);
  });

  it("treats a team abbreviation as a DEF", () => {
    const res = avoidableIces(zeroAt(9, "HOU", { NYJ: 5, bk1: 9 }), () => undefined);
    expect(res).toEqual([expect.objectContaining({ playerId: "NYJ", points: 5 })]);
  });

  it("ignores bench players who scored 0 or less, and sorts by points left", () => {
    expect(avoidableIces(zeroAt(5, "te9", { bte1: 0, bte2: -2 }), synthPosition)).toEqual([]);

    const weeks = [week(1, [iced(1, { 5: ["te9", 0] }, { bte1: 3 }), iced(2, { 0: ["qb9", 0] }, { bqb1: 12 })])];
    expect(avoidableIces(weeks, synthPosition).map((x) => x.points)).toEqual([12, 3]);
  });
});

describe("closestEscapes", () => {
  it("keeps starters above 0 and at most 1.0", () => {
    const starters = [...FULL];
    const points = [0, 0.01, 1.0, 1.01, 10, 10, 10, 10, 10, 0.5];
    const res = closestEscapes([week(1, [row(1, starters, points)])]);
    expect(res.map((e) => [e.playerId, e.points])).toEqual([
      ["rb1", 0.01],
      ["DAL", 0.5],
      ["rb2", 1.0],
    ]);
  });
});

describe("iceStreaks", () => {
  const qbZero = (rosterId: number) => iced(rosterId, { 0: ["qb9", 0] });

  it("measures the longest and current runs of weeks with an ice", () => {
    const weeks = [
      week(1, [qbZero(1), qbZero(2), clean(3)]),
      week(2, [qbZero(1), clean(2), clean(3)]),
      week(3, [clean(1), qbZero(2), clean(3)]),
      week(4, [qbZero(1), qbZero(2), clean(3)]),
    ];
    const streaks = iceStreaks(weeks);
    expect(streaks.find((s) => s.rosterId === 1)).toEqual({ rosterId: 1, longest: 2, current: 1 });
    expect(streaks.find((s) => s.rosterId === 2)).toEqual({ rosterId: 2, longest: 2, current: 2 });
    expect(streaks.find((s) => s.rosterId === 3)).toEqual({ rosterId: 3, longest: 0, current: 0 });
    expect(streaks.find((s) => s.rosterId === 99)).toEqual({ rosterId: 99, longest: 4, current: 4 });
  });

  it("orders ties on longest by current, then roster id", () => {
    const weeks = [week(1, [qbZero(3), qbZero(1), clean(2)]), week(2, [clean(3), qbZero(1), qbZero(2)])];
    expect(iceStreaks(weeks).map((s) => s.rosterId)).toEqual([1, 99, 2, 3]);
  });
});

describe("per-team counts", () => {
  it("counts empty and lowest ices per team, ties by roster id", () => {
    const noK: Record<number, [string, number]> = { 8: ["0", 0] };
    const weeks = [
      week(1, [iced(2, noK), iced(1, noK), clean(3)]),
      week(2, [iced(3, noK), clean(1), clean(2)]),
    ];
    const stats = iceStats(weeks, synthPosition);
    expect(stats.lazyManager).toEqual([
      { rosterId: 1, count: 1 },
      { rosterId: 2, count: 1 },
      { rosterId: 3, count: 1 },
    ]);
    expect(stats.lowestMagnets).toEqual([{ rosterId: 99, count: 2 }]);
    expect(stats.byTeam).toEqual([
      { rosterId: 99, count: 2 },
      { rosterId: 1, count: 1 },
      { rosterId: 2, count: 1 },
      { rosterId: 3, count: 1 },
    ]);
    expect(stats.byPosition).toEqual({ K: 3 });
  });

  it("buckets positions from players.json, falling back to the slot", () => {
    const z = iced(1, { 6: ["wr9", 0], 9: ["HOU", -1], 0: ["mystery", 0] });
    const stats = iceStats([week(1, [z])], synthPosition);
    expect(stats.byPosition).toEqual({ WR: 1, DEF: 1, QB: 1 });
  });
});
