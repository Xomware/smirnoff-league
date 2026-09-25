import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/espn";
import { golden } from "@/lib/test/league-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { liveLowest, troubleByRoster } from "./trouble";

const game = (state: Game["state"]): Game => ({ id: "g", kickoff: "", state, status: "", period: 1, clock: "", completed: false, teams: ["NYJ", "MIA"] });
const w2 = golden.weeks[1].matchups;
const low = Math.min(...w2.map((m) => m.points));

describe("troubleByRoster", () => {
  it("marks late for overdue or unpaid late ices, owe for anything else owed, and nothing for the square", () => {
    const summary = [
      ...SCENARIO_LEDGER.summary,
      { rosterId: 4, owed: 1, completed: 0, late: 0, lateOwed: 0, overdue: 0 },
      { rosterId: 5, owed: 1, completed: 0, late: 0, lateOwed: 0, overdue: 1 },
    ];
    const trouble = troubleByRoster(summary, []);
    expect(trouble.get(13)).toEqual(["late"]);
    expect(trouble.get(12)).toEqual(["late"]);
    expect(trouble.get(5)).toEqual(["late"]);
    expect(trouble.get(4)).toEqual(["owe"]);
    expect(trouble.has(2)).toBe(false);
  });

  it("adds lowest on top of what a team already owes", () => {
    const trouble = troubleByRoster(SCENARIO_LEDGER.summary, [13, 7]);
    expect(trouble.get(13)).toEqual(["late", "lowest"]);
    expect(trouble.get(7)).toEqual(["lowest"]);
  });
});

describe("liveLowest", () => {
  // Week 3 of 2026: Thursday night kickoff, then Sunday's 1 PM ET slate. 4 PM ET that Sunday is 20:00Z (EDT).
  const thursday = { ...game("in"), kickoff: "2026-09-25T00:15:00Z" };
  const sunday = { ...game("in"), kickoff: "2026-09-27T17:00:00Z" };
  const sundayFour = Date.parse("2026-09-27T20:00:00Z");

  it("names the current lowest scorer once it is 4 PM ET on the week's Sunday and a game is live", () => {
    const expected = w2.filter((m) => m.points === low).map((m) => m.roster_id);
    expect(liveLowest(2, w2, [thursday, sunday], sundayFour)).toEqual(expected);
  });

  it("names nobody before 4 PM ET Sunday, when most teams have barely played", () => {
    expect(liveLowest(2, w2, [thursday, { ...sunday, state: "pre" }], Date.parse("2026-09-25T02:00:00Z"))).toEqual([]);
    expect(liveLowest(2, w2, [thursday, sunday], sundayFour - 60_000)).toEqual([]);
  });

  it("names nobody when no game is live", () => {
    expect(liveLowest(2, w2, [{ ...thursday, state: "post" }, { ...sunday, state: "post" }], sundayFour)).toEqual([]);
  });

  it("names nobody when the schedule has no Sunday game to anchor on", () => {
    expect(liveLowest(2, w2, [thursday], sundayFour)).toEqual([]);
  });
});
