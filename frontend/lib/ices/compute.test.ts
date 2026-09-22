import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  defaultWeekSettings,
  weekIces,
  type Ice,
  type MatchupRow,
  type WeekSettings,
} from "@/lib/ices/compute";

interface GoldenWeek {
  week: number;
  settings: WeekSettings;
  matchups: MatchupRow[];
  expected: Ice[];
}

const golden: { slots: string[]; weeks: GoldenWeek[] } = JSON.parse(
  readFileSync(join(__dirname, "../../../fixtures/ices-golden.json"), "utf8"),
);
const SLOTS = golden.slots;
const ON: WeekSettings = { iceRulesActive: true, lowestScope: "all" };

// Sleeper player ids, confirmed against public/data/players.json.
const KYLE_PITTS = "7553";
const ROMEO_DOUBS = "8121";
const COLSTON_LOVELAND = "12517";
const HOU_DEF = "HOU";
const PUKA_NACUA = "9493";
const DJ_MOORE = "4983";

function goldenWeek(week: number): GoldenWeek {
  const found = golden.weeks.find((w) => w.week === week);
  if (!found) throw new Error(`fixture has no week ${week}`);
  return found;
}

function rosterStarting(week: GoldenWeek, playerId: string): number {
  const row = week.matchups.find((m) => m.starters.includes(playerId));
  if (!row) throw new Error(`nobody started ${playerId} in week ${week.week}`);
  return row.roster_id;
}

function row(rosterId: number, points: number, overrides: Partial<MatchupRow> = {}): MatchupRow {
  return {
    roster_id: rosterId,
    matchup_id: 1,
    points,
    starters: SLOTS.map((_, i) => `p${rosterId}-${i}`),
    starters_points: SLOTS.map(() => 10),
    ...overrides,
  };
}

function withStarterPoints(points: number): MatchupRow {
  const starters_points = SLOTS.map(() => 10);
  starters_points[3] = points;
  return row(1, 150, { starters_points });
}

describe("weekIces golden", () => {
  it.each(golden.weeks)("week $week matches the fixture", (week) => {
    expect(weekIces(week.week, week.matchups, SLOTS, week.settings)).toEqual(week.expected);
  });

  it("G1: W1 zeros for Pitts, Doubs, Loveland, HOU DEF plus lowest for Doubs", () => {
    const w1 = goldenWeek(1);
    const ices = weekIces(1, w1.matchups, SLOTS, ON);

    expect(ices).toHaveLength(5);
    const zeros = ices.filter((i) => i.reason === "zero");
    expect(zeros.map((i) => i.playerId).sort()).toEqual(
      [KYLE_PITTS, ROMEO_DOUBS, COLSTON_LOVELAND, HOU_DEF].sort(),
    );
    expect(new Set(zeros.map((i) => i.rosterId)).size).toBe(4);
    for (const zero of zeros) {
      expect(zero.rosterId).toBe(rosterStarting(w1, zero.playerId as string));
    }
    const lowest = ices.filter((i) => i.reason === "lowest");
    expect(lowest).toHaveLength(1);
    expect(lowest[0].rosterId).toBe(rosterStarting(w1, ROMEO_DOUBS));
    expect(lowest[0].points).toBe(91.46);
  });

  it("G2: W2 zeros for Puka Nacua and DJ Moore plus lowest for DJ Moore", () => {
    const w2 = goldenWeek(2);
    const ices = weekIces(2, w2.matchups, SLOTS, ON);

    expect(ices).toHaveLength(3);
    expect(ices.filter((i) => i.reason === "zero").map((i) => i.playerId).sort()).toEqual(
      [PUKA_NACUA, DJ_MOORE].sort(),
    );
    const lowest = ices.filter((i) => i.reason === "lowest");
    expect(lowest).toHaveLength(1);
    expect(lowest[0].rosterId).toBe(rosterStarting(w2, DJ_MOORE));
    expect(lowest[0].points).toBe(82.1);
  });
});

describe("weekIces rules", () => {
  const lowestElsewhere = row(2, 100);
  const zerosFor = (points: number) =>
    weekIces(3, [withStarterPoints(points), lowestElsewhere], SLOTS, ON).filter(
      (i) => i.reason === "zero",
    );

  it("S1: a 0.0 starter is an ice", () => {
    expect(zerosFor(0)).toEqual([
      {
        id: "W03#R01#S3",
        week: 3,
        rosterId: 1,
        reason: "zero",
        slotIndex: 3,
        slot: "WR",
        playerId: "p1-3",
        points: 0,
      },
    ]);
  });

  it("S2: a 0.01 starter is not an ice", () => {
    expect(zerosFor(0.01)).toEqual([]);
  });

  it("S3: a negative starter is an ice", () => {
    expect(zerosFor(-2)).toHaveLength(1);
  });

  it('S4: a "0" starter is an empty ice', () => {
    const starters = SLOTS.map((_, i) => `p1-${i}`);
    starters[2] = "0";
    const ices = weekIces(3, [row(1, 150, { starters }), lowestElsewhere], SLOTS, ON);

    expect(ices.filter((i) => i.rosterId === 1)).toEqual([
      {
        id: "W03#R01#S2",
        week: 3,
        rosterId: 1,
        reason: "empty",
        slotIndex: 2,
        slot: "RB",
        playerId: null,
        points: 0,
      },
    ]);
  });

  it("S5: starters shorter than the slots leave the rest empty", () => {
    const short = row(1, 150, {
      starters: SLOTS.slice(0, 8).map((_, i) => `p1-${i}`),
      starters_points: SLOTS.slice(0, 8).map(() => 10),
    });
    const ices = weekIces(3, [short, lowestElsewhere], SLOTS, ON).filter((i) => i.rosterId === 1);

    expect(ices.map((i) => [i.reason, i.slotIndex, i.slot])).toEqual([
      ["empty", 8, "K"],
      ["empty", 9, "DEF"],
    ]);
  });

  it("S6: a tie for lowest after rounding gives both rosters an ice", () => {
    const ices = weekIces(3, [row(1, 101.3), row(2, 101.29999999999998), row(3, 120)], SLOTS, ON);

    expect(ices.map((i) => [i.id, i.points])).toEqual([
      ["W03#R01#LOWEST", 101.3],
      ["W03#R02#LOWEST", 101.3],
    ]);
  });

  it("S7: two zeros and lowest on one roster is 3 ices", () => {
    const starters_points = SLOTS.map(() => 10);
    starters_points[0] = 0;
    starters_points[9] = -3;
    const ices = weekIces(3, [row(1, 60, { starters_points }), row(2, 120)], SLOTS, ON);

    expect(ices.map((i) => i.id)).toEqual(["W03#R01#LOWEST", "W03#R01#S0", "W03#R01#S9"]);
  });

  it("S8: rules off gives no ices", () => {
    const w1 = goldenWeek(1);
    expect(weekIces(1, w1.matchups, SLOTS, { iceRulesActive: false, lowestScope: "all" })).toEqual(
      [],
    );
  });

  it("S9: lowestScope played skips a roster with no matchup", () => {
    const rows = [row(1, 70, { matchup_id: null }), row(2, 90), row(3, 120)];
    const lowestOf = (settings: WeekSettings) =>
      weekIces(15, rows, SLOTS, settings)
        .filter((i) => i.reason === "lowest")
        .map((i) => i.rosterId);

    expect(lowestOf({ iceRulesActive: true, lowestScope: "played" })).toEqual([2]);
    expect(lowestOf({ iceRulesActive: true, lowestScope: "all" })).toEqual([1]);
  });
});

describe("season tally from real weeks", () => {
  it("totals owed ices per roster across weeks", () => {
    const w1 = goldenWeek(1);
    const w2 = goldenWeek(2);
    // W3: W1's scores replayed, with roster 3 leaving its QB slot empty.
    const w3 = w1.matchups.map((m) =>
      m.roster_id === 3 ? { ...m, starters: ["0", ...m.starters.slice(1)] } : m,
    );
    // W15: W2's scores replayed after the ice rules switch off.
    const season: [number, MatchupRow[]][] = [
      [1, w1.matchups],
      [2, w2.matchups],
      [3, w3],
      [15, w2.matchups],
    ];

    const tally: Record<number, number> = {};
    for (const [week, matchups] of season) {
      for (const ice of weekIces(week, matchups, SLOTS, defaultWeekSettings(week))) {
        tally[ice.rosterId] = (tally[ice.rosterId] ?? 0) + 1;
      }
    }

    expect(tally).toEqual({ 2: 2, 3: 1, 6: 4, 8: 2, 12: 3, 13: 2 });
  });
});
