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
  it("names the current lowest scorer while a game is in progress", () => {
    const expected = w2.filter((m) => m.points === low).map((m) => m.roster_id);
    expect(liveLowest(2, w2, [game("post"), game("in")])).toEqual(expected);
  });

  it("names nobody when no game is live", () => {
    expect(liveLowest(2, w2, [game("pre"), game("post")])).toEqual([]);
  });
});
