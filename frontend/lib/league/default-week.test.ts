import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/espn";
import type { SleeperNflState } from "@/lib/sleeper/types";
import { defaultWeek } from "./default-week";

const nfl = (week: number, season_type = "regular"): SleeperNflState => ({
  week,
  display_week: week,
  season: "2026",
  season_type,
  leg: week,
});

const game = (kickoff: string): Game => ({
  id: kickoff,
  kickoff,
  state: "pre",
  status: "STATUS_SCHEDULED",
  period: 0,
  clock: "0:00",
  completed: false,
  teams: ["DAL", "NYG"],
});

// Week 4 of 2026: Thursday night kickoff 8:15pm ET, then the Sunday slate.
const week4 = [game("2026-10-04T17:00Z"), game("2026-10-02T00:15Z"), game("2026-10-06T00:15Z")];

describe("defaultWeek", () => {
  it("shows last week on the Wednesday before the new week kicks off", () => {
    expect(defaultWeek(nfl(4), week4, new Date("2026-09-30T16:00Z"))).toBe(3);
  });

  it("switches to the current week once Thursday night kicks off", () => {
    expect(defaultWeek(nfl(4), week4, new Date("2026-10-02T00:14Z"))).toBe(3);
    expect(defaultWeek(nfl(4), week4, new Date("2026-10-02T00:15Z"))).toBe(4);
  });

  it("trusts ESPN's game state over a device clock that runs slow", () => {
    const [sunday, ...rest] = week4;
    expect(defaultWeek(nfl(4), [{ ...sunday, state: "in" }, ...rest], new Date("2026-10-01T23:00Z"))).toBe(4);
  });

  it("shows week 1 in the preseason and before week 1 kicks off", () => {
    expect(defaultWeek(nfl(0, "pre"), [], new Date("2026-08-20T16:00Z"))).toBe(1);
    expect(defaultWeek(nfl(1), [game("2026-09-11T00:20Z")], new Date("2026-09-09T16:00Z"))).toBe(1);
  });
});
