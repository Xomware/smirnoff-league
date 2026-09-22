import { describe, expect, it } from "vitest";

import type { SleeperBracketMatch, SleeperMatchup } from "@/lib/sleeper/types";
import { type Bracket, projectedPlayoffBracket, punishmentRisk, toiletBowl } from "./brackets";

// Roster ids deliberately differ from seeds: seed n is roster 100 + n.
const seeds = Array.from({ length: 14 }, (_, i) => 101 + i);
const roster = (seed: number) => 100 + seed;

const pairs = (b: Bracket, round: number) =>
  b.rounds[round - 1].map((m) => [m.a.rosterId, m.b.rosterId]);

function week(points: Record<number, number>): SleeperMatchup[] {
  return Object.entries(points).map(([id, pts]) => ({
    roster_id: Number(id),
    matchup_id: null,
    points: pts,
    custom_points: null,
    starters: [],
    starters_points: [],
    players: null,
    players_points: null,
  }));
}

describe("projectedPlayoffBracket", () => {
  it("pairs 1v8, 4v5, 3v6, 2v7 with later rounds TBD", () => {
    const b = projectedPlayoffBracket(seeds);
    expect(pairs(b, 1)).toEqual([
      [roster(1), roster(8)],
      [roster(4), roster(5)],
      [roster(3), roster(6)],
      [roster(2), roster(7)],
    ]);
    expect(pairs(b, 2)).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(b.rounds[2]).toHaveLength(1);
  });
});

describe("toiletBowl fallback", () => {
  it("gives the round-1 byes to seeds 13 and 14 when losers_bracket is empty", () => {
    const b = toiletBowl(seeds, []);
    expect(b.byes.map((s) => s.rosterId)).toEqual([roster(13), roster(14)]);
    expect(pairs(b, 1)).toEqual([
      [roster(9), roster(12)],
      [roster(10), roster(11)],
    ]);
  });

  it("treats a null losers_bracket like an empty one", () => {
    expect(toiletBowl(seeds, null).byes.map((s) => s.seed)).toEqual([13, 14]);
  });

  it("sends round-1 losers to the bye teams, then to a final, all TBD before results", () => {
    const b = toiletBowl(seeds, []);
    expect(b.rounds[1].map((m) => [m.a.from, m.b.rosterId])).toEqual([
      ["Loser of game 1", roster(13)],
      ["Loser of game 2", roster(14)],
    ]);
    expect(b.rounds[2].map((m) => [m.a.from, m.b.from])).toEqual([["Loser of game 3", "Loser of game 4"]]);
    expect(b.punished).toBeNull();
  });

  it("honours a configured bye pair", () => {
    const b = toiletBowl(seeds, [], [], { byes: [9, 10] });
    expect(pairs(b, 1)).toEqual([
      [roster(11), roster(14)],
      [roster(12), roster(13)],
    ]);
  });

  it("punishes the loser of the final, resolved from weeks 15-17", () => {
    const results = [
      // 9 beats 12, 11 beats 10: 12 and 10 advance.
      week({ [roster(9)]: 120, [roster(12)]: 80, [roster(10)]: 90, [roster(11)]: 95 }),
      // 12 beats 13, 14 beats 10: 13 and 10 advance.
      week({ [roster(12)]: 110, [roster(13)]: 100, [roster(10)]: 70, [roster(14)]: 101 }),
      week({ [roster(13)]: 88.5, [roster(10)]: 88.4 }),
    ];
    const b = toiletBowl(seeds, [], results);
    expect(b.rounds[1].map((m) => [m.a.rosterId, m.b.rosterId])).toEqual([
      [roster(12), roster(13)],
      [roster(10), roster(14)],
    ]);
    expect(b.punished).toBe(roster(10));
    expect(punishmentRisk(b)).toEqual([roster(10)]);
  });

  it("leaves a week with no results TBD", () => {
    const b = toiletBowl(seeds, [], [week({ [roster(9)]: 120, [roster(12)]: 80 })]);
    expect(b.rounds[0][0].loser).toBe(roster(12));
    expect(b.rounds[0][1].loser).toBeNull();
    expect(b.rounds[1][1].a).toMatchObject({ rosterId: null, from: "Loser of game 2" });
  });
});

describe("toiletBowl from Sleeper", () => {
  const sleeper: SleeperBracketMatch[] = [
    { r: 1, m: 1, t1: roster(10), t2: roster(13), w: roster(10), l: roster(13) },
    { r: 1, m: 2, t1: roster(11), t2: roster(12), w: null, l: null },
    { r: 2, m: 3, t1: roster(13), t2: roster(9), w: null, l: null, t1_from: { l: 1 }, p: 1 },
    { r: 2, m: 4, t1: null, t2: roster(14), w: null, l: null, t1_from: { l: 2 } },
  ];

  it("renders a non-empty losers_bracket as-is", () => {
    const b = toiletBowl(seeds, sleeper);
    expect(pairs(b, 1)).toEqual([
      [roster(10), roster(13)],
      [roster(11), roster(12)],
    ]);
    expect(pairs(b, 2)).toEqual([
      [roster(13), roster(9)],
      [null, roster(14)],
    ]);
    expect(b.rounds[1][1].a.from).toBe("Loser of game 2");
    expect(b.byes.map((s) => s.rosterId)).toEqual([roster(9), roster(14)]);
    expect(punishmentRisk(b)).toEqual([roster(9), roster(11), roster(12), roster(13), roster(14)]);
  });
});

describe("punishmentRisk", () => {
  it("is the bottom 6 by standings before week 15", () => {
    expect(punishmentRisk(toiletBowl(seeds, []))).toEqual(seeds.slice(8));
  });
});
