import { describe, expect, it } from "vitest";

import type { LedgerIce } from "@/lib/api/ledger";
import type { StatsMatchup } from "@/lib/ices/stats";
import { golden } from "@/lib/test/league-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { type Award, type AwardId, awardLine, awardStat, awardTally, finalWeeks, type WeekAwards, weekAwards } from "./awards";

const noPositions = () => undefined;
const find = (w: WeekAwards, id: AwardId) => w.awards.find((a) => a.id === id);
const ids = (w: WeekAwards) => w.awards.map((a) => a.id);

// A full ten-slot lineup: QB RB RB WR WR TE FLEX FLEX K DEF.
function side(rosterId: number, matchupId: number | null, points: number, bench: Record<string, number> = {}): StatsMatchup {
  const starters = Array.from({ length: 10 }, (_, i) => `${rosterId}0${i}`);
  const starters_points = Array.from({ length: 10 }, (_, i) => (i === 0 ? points : 0));
  return {
    roster_id: rosterId,
    matchup_id: matchupId,
    points,
    starters,
    starters_points,
    players: [...starters, ...Object.keys(bench)],
    players_points: { ...Object.fromEntries(starters.map((id, i) => [id, starters_points[i]])), ...bench },
  };
}

const chug = (iceId: string, week: number, rosterId: number, chugSeconds: number, name?: string): LedgerIce => ({
  iceId,
  week,
  rosterId,
  reason: "zero",
  status: "completed",
  chugSeconds,
  ...(name ? { chugger: { name } } : {}),
});

describe("weekAwards on the golden weeks", () => {
  const w1 = weekAwards(1, golden.weeks[0].matchups, SCENARIO_LEDGER.ices, noPositions);
  const w2 = weekAwards(2, golden.weeks[1].matchups, SCENARIO_LEDGER.ices, noPositions);

  it("gives W1 its top score, blowout and escape from the real results", () => {
    expect(find(w1, "top-score")).toEqual({ id: "top-score", value: 182.7, winners: [{ rosterId: 14 }] });
    expect(find(w1, "blowout")).toEqual({ id: "blowout", value: 59.14, winners: [{ rosterId: 14, opponent: 3 }] });
    expect(find(w1, "escape")).toEqual({ id: "escape", value: 5.26, winners: [{ rosterId: 2, opponent: 4 }] });
  });

  it("finds the best bench player across every roster", () => {
    expect(find(w1, "bench-hero")).toEqual({ id: "bench-hero", value: 25.2, winners: [{ rosterId: 2, playerId: "12545" }] });
    expect(find(w2, "bench-hero")).toEqual({ id: "bench-hero", value: 29.78, winners: [{ rosterId: 8, playerId: "3163" }] });
  });

  it("crowns the team with the most of the week's ledger ices, not counting late rows", () => {
    expect(find(w1, "ice-king")).toEqual({ id: "ice-king", value: 2, winners: [{ rosterId: 6 }] });
    // Roster 13 also has two late rows in W2; with them it would be four.
    expect(find(w2, "ice-king")).toEqual({ id: "ice-king", value: 2, winners: [{ rosterId: 13 }] });
  });

  it("gives W2 its own results", () => {
    expect(find(w2, "top-score")?.winners).toEqual([{ rosterId: 1 }]);
    expect(find(w2, "blowout")).toEqual({ id: "blowout", value: 67.7, winners: [{ rosterId: 1, opponent: 6 }] });
    expect(find(w2, "escape")).toEqual({ id: "escape", value: 11.3, winners: [{ rosterId: 2, opponent: 3 }] });
  });

  it("skips Fastest Chug when nobody timed a chug", () => {
    expect(find(w1, "fastest-chug")).toBeUndefined();
  });
});

describe("Biggest Choke", () => {
  it("is the loser who left the most on the bench against the optimal lineup", () => {
    const positions: Record<string, string> = { b1: "WR", b2: "QB", b3: "WR" };
    const weak = side(3, 1, 80, { b1: 30 });
    const weaker = side(4, 2, 70, { b2: 15 });
    // The winner's bench never counts.
    const winners = [side(1, 1, 120, { b3: 90 }), side(2, 2, 110)];
    const award = weekAwards(1, [weak, weaker, ...winners], null, (id) => positions[id]).awards.find((a) => a.id === "choke");
    // b1's 30 replaces a scoreless WR. b2 is a 15-point QB behind a 70-point one, so leaves nothing.
    expect(award).toEqual({ id: "choke", value: 30, winners: [{ rosterId: 3, opponent: 1 }] });
  });

  it("is not awarded when every loser played their best lineup", () => {
    const week = weekAwards(1, [side(1, 1, 120), side(2, 1, 100)], null, noPositions);
    expect(ids(week)).not.toContain("choke");
  });
});

describe("ties", () => {
  it("shares an award between teams on the same number", () => {
    const week = weekAwards(
      1,
      [side(1, 1, 150, { p1: 20 }), side(2, 1, 90), side(3, 2, 150, { p3: 20 }), side(4, 2, 90), side(5, 3, 100), side(6, 3, 99)],
      null,
      noPositions,
    );
    expect(find(week, "top-score")?.winners).toEqual([{ rosterId: 1 }, { rosterId: 3 }]);
    expect(find(week, "blowout")).toEqual({
      id: "blowout",
      value: 60,
      winners: [
        { rosterId: 1, opponent: 2 },
        { rosterId: 3, opponent: 4 },
      ],
    });
    expect(find(week, "bench-hero")?.winners).toEqual([
      { rosterId: 1, playerId: "p1" },
      { rosterId: 3, playerId: "p3" },
    ]);
  });

  it("compares scores to the hundredth, so float noise doesn't break a tie", () => {
    const week = weekAwards(1, [side(1, 1, 0.1 + 0.2), side(2, 1, 0), side(3, 2, 0.3), side(4, 2, 0)], null, noPositions);
    expect(find(week, "top-score")?.winners).toEqual([{ rosterId: 1 }, { rosterId: 3 }]);
  });

  it("leaves a tied game out of the margin awards", () => {
    const week = weekAwards(1, [side(1, 1, 100), side(2, 1, 100), side(3, 2, 110), side(4, 2, 100)], null, noPositions);
    expect(find(week, "escape")).toEqual({ id: "escape", value: 10, winners: [{ rosterId: 3, opponent: 4 }] });
  });

  it("shares Ice King and Fastest Chug", () => {
    const ices = [chug("a", 1, 1, 6.2, "A"), chug("b", 1, 2, 6.2), chug("c", 1, 2, 9), chug("d", 1, 1, 7)];
    const week = weekAwards(1, null, ices, noPositions);
    expect(find(week, "ice-king")).toEqual({ id: "ice-king", value: 2, winners: [{ rosterId: 1 }, { rosterId: 2 }] });
    expect(find(week, "fastest-chug")).toEqual({
      id: "fastest-chug",
      value: 6.2,
      winners: [
        { rosterId: 1, chugger: "A" },
        { rosterId: 2, chugger: null },
      ],
    });
  });
});

describe("missing data", () => {
  it("gives only the ledger awards when Sleeper has no matchups for the week", () => {
    const week = weekAwards(3, null, [chug("a", 3, 5, 8, "A"), chug("b", 2, 6, 4, "B")], noPositions);
    expect(ids(week)).toEqual(["fastest-chug", "ice-king"]);
    expect(find(week, "fastest-chug")?.winners).toEqual([{ rosterId: 5, chugger: "A" }]);
  });

  it("gives only the Sleeper awards without the ledger", () => {
    const week = weekAwards(1, golden.weeks[0].matchups, null, noPositions);
    expect(ids(week)).toEqual(expect.arrayContaining(["top-score", "blowout", "escape", "bench-hero"]));
    expect(ids(week)).not.toContain("ice-king");
    expect(ids(week)).not.toContain("fastest-chug");
  });

  it("gives nothing for an empty week", () => {
    expect(weekAwards(4, [], [], noPositions).awards).toEqual([]);
  });

  it("skips a roster with no lineup for the bench awards but still scores it", () => {
    const blank = { ...side(1, 1, 140, { p1: 50 }), starters: null };
    const week = weekAwards(1, [blank, side(2, 1, 100, { p2: 10 })], null, noPositions);
    expect(find(week, "top-score")?.winners).toEqual([{ rosterId: 1 }]);
    expect(find(week, "bench-hero")?.winners).toEqual([{ rosterId: 2, playerId: "p2" }]);
  });

  it("leaves out a team without a matchup, one missing its opponent, and a week nobody scored in", () => {
    const week = weekAwards(1, [side(1, 1, 120), side(2, null, 150)], null, noPositions);
    expect(week.awards).toEqual([{ id: "top-score", value: 120, winners: [{ rosterId: 1 }] }]);
    expect(weekAwards(1, [side(1, 1, 0), side(2, 1, 0)], null, noPositions).awards).toEqual([]);
  });
});

describe("finalWeeks", () => {
  it("takes the weeks the ledger has finalized", () => {
    const weeks = [
      { week: 2, finalizedAt: "2026-09-22T08:00:00+00:00", deadlineUtc: null },
      { week: 1, finalizedAt: "2026-09-15T08:00:00+00:00", deadlineUtc: null },
      { week: 3, finalizedAt: null, deadlineUtc: null },
    ];
    expect(finalWeeks(4, weeks)).toEqual([1, 2]);
  });

  it("falls back to the weeks Sleeper has moved past without the ledger", () => {
    expect(finalWeeks(3, null)).toEqual([1, 2]);
    expect(finalWeeks(1, null)).toEqual([]);
  });
});

describe("awardTally", () => {
  const award = (id: AwardId, ...rosterIds: number[]): Award => ({ id, value: 1, winners: rosterIds.map((rosterId) => ({ rosterId })) });
  const weeks: WeekAwards[] = [
    { week: 1, awards: [award("top-score", 1), award("ice-king", 2, 3)] },
    { week: 2, awards: [award("top-score", 1), award("ice-king", 3)] },
    { week: 3, awards: [award("top-score", 2)] },
  ];

  it("counts a shared award for every winner and names each award's leaders", () => {
    const tally = awardTally(weeks);
    expect(tally.byAward.find((a) => a.id === "top-score")).toEqual({ id: "top-score", count: 2, leaders: [1] });
    expect(tally.byAward.find((a) => a.id === "ice-king")).toEqual({ id: "ice-king", count: 2, leaders: [3] });
    expect(tally.byAward.find((a) => a.id === "blowout")).toEqual({ id: "blowout", count: 0, leaders: [] });
  });

  it("ranks teams by awards won, ties by roster", () => {
    expect(awardTally(weeks).teams).toEqual([
      { rosterId: 1, count: 2 },
      { rosterId: 2, count: 2 },
      { rosterId: 3, count: 2 },
    ]);
  });
});

describe("awardLine", () => {
  const names = { team: (id: number) => `Team ${id}`, player: (id: string) => `Player ${id}` };

  it("says what each award was for", () => {
    const line = (id: AwardId, value: number, winner: Award["winners"][number]) => awardLine({ id, value, winners: [winner] }, winner, names);
    expect(line("top-score", 182.7, { rosterId: 1 })).toBe("Put up 182.70, the most in the league");
    expect(line("blowout", 59.14, { rosterId: 1, opponent: 3 })).toBe("Beat Team 3 by 59.14");
    expect(line("escape", 5.26, { rosterId: 2, opponent: 4 })).toBe("Held off Team 4 by 5.26");
    expect(line("choke", 28, { rosterId: 3, opponent: 1 })).toBe("Lost to Team 1 with 28.00 left on the bench");
    expect(line("bench-hero", 25.2, { rosterId: 2, playerId: "12545" })).toBe("Player 12545 scored 25.20 on the bench");
    expect(line("fastest-chug", 6.2, { rosterId: 1, chugger: "A" })).toBe("A downed it in 6.2s");
    expect(line("fastest-chug", 6.2, { rosterId: 1, chugger: null })).toBe("Downed in 6.2s");
    expect(line("ice-king", 1, { rosterId: 1 })).toBe("1 ice, the most in the league");
    expect(line("ice-king", 3, { rosterId: 1 })).toBe("3 ices, the most in the league");
  });

  it("formats the headline number for each kind of award", () => {
    expect(awardStat({ id: "blowout", value: 59.1, winners: [] })).toBe("59.10 pts");
    expect(awardStat({ id: "fastest-chug", value: 6, winners: [] })).toBe("6.0s");
    expect(awardStat({ id: "ice-king", value: 1, winners: [] })).toBe("1 ice");
  });
});
