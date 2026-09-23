import { describe, expect, it } from "vitest";

import { golden, W1_POSITIONS } from "@/lib/test/league-mock";
import {
  benchPoints,
  heatCheck,
  iceAnalysis,
  iceRace,
  iceRate,
  icesVsResults,
  positionRisk,
  takeaways,
  weeklyExtremes,
} from "./analysis";
import type { StatsMatchup } from "./stats";

const w1Position = (id: string) => W1_POSITIONS[id];
const name = (id: number) => `Team ${id}`;

const FULL = ["qb", "rb1", "rb2", "wr1", "wr2", "te", "fx1", "fx2", "k", "DAL"];
const row = (
  rosterId: number,
  matchupId: number,
  points: number[] = FULL.map(() => 10),
  bench: Record<string, number> = {},
  starters: string[] = FULL,
): StatsMatchup => ({
  roster_id: rosterId,
  matchup_id: matchupId,
  points: points.reduce((a, b) => a + b, 0),
  starters,
  starters_points: points,
  players: [...starters, ...Object.keys(bench)],
  players_points: bench,
});
const zeroAt = (slot: number) => FULL.map((_, i) => (i === slot ? 0 : 10));
const synthPosition = (id: string) =>
  ({ qb: "QB", rb: "RB", wr: "WR", te: "TE", k: "K", fx: "WR" })[id.replace(/\d+$/, "").replace(/^b/, "")];

describe("on the golden W1/W2 weeks", () => {
  it("races cumulative ices, leaders first", () => {
    const race = iceRace(golden.weeks);
    expect(race.weeks).toEqual([1, 2]);
    expect(race.teams.slice(0, 5)).toEqual([
      { rosterId: 6, cumulative: [2, 2], total: 2 },
      { rosterId: 12, cumulative: [1, 2], total: 2 },
      { rosterId: 13, cumulative: [0, 2], total: 2 },
      { rosterId: 2, cumulative: [1, 1], total: 1 },
      { rosterId: 8, cumulative: [1, 1], total: 1 },
    ]);
    expect(race.teams).toHaveLength(14);
    expect(race.teams[13]).toEqual({ rosterId: 14, cumulative: [0, 0], total: 0 });
  });

  it("rates slot ices per start against the league average", () => {
    const rate = iceRate(golden.weeks);
    expect(rate.league).toBeCloseTo(6 / 280);
    expect(rate.teams[0]).toEqual({ rosterId: 12, ices: 2, starts: 20, rate: 0.1 });
  });

  it("finds the 37.8 roster 2 left on the bench in W1, the 23.7 TE included", () => {
    const r2 = benchPoints(golden.weeks, w1Position).find((t) => t.rosterId === 2)!;
    expect(r2.weeks.map((w) => [w.week, w.actual, w.optimal, w.left])).toEqual([
      [1, 120.2, 158, 37.8],
      [2, 105.58, 106.68, 1.1],
    ]);
    expect(r2.total).toBe(38.9);
    expect(r2.worst.week).toBe(1);
    expect(r2.worst.benched).toEqual([
      { playerId: "12545", position: "QB", points: 25.2 },
      { playerId: "5022", position: "TE", points: 23.7 },
      { playerId: "5872", position: "WR", points: 18 },
    ]);
  });

  it("splits win% by weeks with and without a slot ice", () => {
    const { league, teams } = icesVsResults(golden.weeks);
    expect(league).toEqual({ iced: { wins: 3, games: 6 }, clean: { wins: 11, games: 22 } });
    expect(teams.find((t) => t.rosterId === 12)).toEqual({
      rosterId: 12,
      iced: { wins: 1, games: 2 },
      clean: { wins: 0, games: 0 },
    });
  });

  it("rates each slot type by starts", () => {
    const risk = positionRisk(golden.weeks);
    expect(risk.map((r) => [r.slot, r.ices, r.starts])).toEqual([
      ["QB", 0, 28],
      ["RB", 0, 56],
      ["WR", 3, 56],
      ["TE", 2, 28],
      ["FLEX", 0, 56],
      ["K", 0, 28],
      ["DEF", 1, 28],
    ]);
  });

  it("picks each week's high, low, blowout and closest game", () => {
    const [w1, w2] = weeklyExtremes(golden.weeks);
    expect(w1.high).toEqual({ rosterId: 14, points: 182.7 });
    expect(w1.low).toEqual({ rosterId: 6, points: 91.46 });
    expect(w1.blowout).toEqual({ winner: 14, loser: 3, winnerPoints: 182.7, loserPoints: 123.56, margin: 59.14 });
    expect(w1.closest).toEqual({ winner: 2, loser: 4, winnerPoints: 120.2, loserPoints: 114.94, margin: 5.26 });
    expect(w2.blowout.margin).toBe(67.7);
    expect(w2.closest).toMatchObject({ winner: 2, loser: 3, margin: 11.3 });
  });

  it("heat-checks the last three weeks, most recent weighted 3", () => {
    expect(heatCheck(golden.weeks).slice(0, 5)).toEqual([
      { rosterId: 13, score: 6, recent: [2, 0] },
      { rosterId: 12, score: 5, recent: [1, 1] },
      { rosterId: 6, score: 4, recent: [0, 2] },
      { rosterId: 2, score: 2, recent: [0, 1] },
      { rosterId: 8, score: 2, recent: [0, 1] },
    ]);
  });

  it("writes a takeaway per section", () => {
    const t = takeaways(iceAnalysis(golden.weeks, w1Position), name);
    expect(t.race).toBe("Team 6, Team 12 and Team 13 are tied for the lead on 2 ices.");
    expect(t.weeks).toBe("W1 was the iciest week, with 5 ices.");
    expect(t.rate).toBe("Team 12 ices 10.0% of starts, 4.7x the league average of 2.1%.");
    expect(t.bench).toMatch(/^Team \d+ has left [\d.]+ points on the bench, [\d.]+ of it in W\d\.$/);
    expect(t.results).toBe("Teams win 50% of weeks with a slot ice and 50% of weeks without.");
    expect(t.positions).toBe("TE slots ice 7.1% of the time, while QB, RB, FLEX and K slots have yet to ice.");
    expect(t.extremes).toBe("Biggest blowout: Team 1 over Team 6 by 67.7 in W2.");
    expect(t.heat).toBe("Team 13 is most likely to ice next, with 2 ices in the last 3 weeks.");
  });
});

describe("benchPoints", () => {
  const bench = (points: number[], extra: Record<string, number>) =>
    benchPoints([{ week: 1, matchups: [row(1, 1, points, extra)] }], synthPosition)[0].weeks[0];

  it("lets FLEX take a benched RB, WR or TE but never a QB or K", () => {
    const w = bench(zeroAt(6), { bqb1: 8, bk1: 8, bwr1: 3 });
    expect(w.left).toBe(3);
    expect(w.benched).toEqual([{ playerId: "bwr1", position: "WR", points: 3 }]);
  });

  it("promotes a benched RB into the RB slot and bumps the starter to FLEX", () => {
    const w = bench(FULL.map((_, i) => (i === 7 ? 2 : 10)), { brb1: 15 });
    expect(w.left).toBe(13);
  });

  it("skips bench players with no known position and rosters with no lineup", () => {
    expect(bench(zeroAt(0), { mystery: 50 }).left).toBe(0);
    const missing = { ...row(2, 1), starters: null };
    expect(benchPoints([{ week: 1, matchups: [missing] }], synthPosition)).toEqual([]);
  });

  it("ranks teams by season total", () => {
    const weeks = [{ week: 1, matchups: [row(1, 1, zeroAt(0), { bqb1: 5 }), row(2, 1, zeroAt(0), { bqb1: 9 })] }];
    expect(benchPoints(weeks, synthPosition).map((t) => [t.rosterId, t.total])).toEqual([
      [2, 9],
      [1, 5],
    ]);
  });
});

describe("icesVsResults", () => {
  it("counts a tie as half a win and skips byes", () => {
    const weeks = [{ week: 1, matchups: [row(1, 1, zeroAt(0)), row(2, 1, zeroAt(1)), { ...row(3, 2), matchup_id: null }] }];
    expect(icesVsResults(weeks).league).toEqual({ iced: { wins: 1, games: 2 }, clean: { wins: 0, games: 0 } });
  });
});

describe("heatCheck", () => {
  it("only looks at the last three weeks and breaks ties by roster id", () => {
    const iced = (id: number) => row(id, 1, zeroAt(0));
    const clean = (id: number) => row(id, 1);
    const weeks = [1, 2, 3, 4].map((week) => ({
      week,
      matchups: week === 1 ? [iced(1), clean(2), row(9, 2, [1])] : [clean(1), clean(2), row(9, 2, [1])],
    }));
    expect(heatCheck(weeks).map((h) => [h.rosterId, h.score])).toEqual([
      [9, 6],
      [1, 0],
      [2, 0],
    ]);
  });
});

describe("takeaways with nothing to say", () => {
  it("keeps every line honest when no one has iced", () => {
    const weeks = [{ week: 1, matchups: [row(1, 1, FULL.map(() => 10)), row(2, 1, FULL.map(() => 10))] }];
    const t = takeaways(iceAnalysis(weeks, synthPosition), name);
    expect(t.rate).toBe("No slot has iced yet.");
    expect(t.positions).toBe("No slot has iced yet.");
    expect(t.bench).toBe("Every lineup was optimal. Nobody left a point on the bench.");
  });
});
