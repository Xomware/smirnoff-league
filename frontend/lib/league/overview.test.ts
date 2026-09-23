import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/espn";
import { formatKickoff, weekHeadline } from "./overview";

function game(state: Game["state"], kickoff = "2026-09-28T17:00Z"): Game {
  return { id: kickoff + state, kickoff, state, status: "", period: 0, clock: "0:00", completed: state === "post", teams: [] };
}

describe("formatKickoff", () => {
  it("shows the day and time in Eastern", () => {
    expect(formatKickoff("2026-10-02T00:15Z")).toBe("Thu 8:15 PM ET");
    expect(formatKickoff("2026-10-04T17:00Z")).toBe("Sun 1:00 PM ET");
  });
});

describe("weekHeadline", () => {
  it("names the first kickoff before any game starts", () => {
    const games = [game("pre", "2026-10-04T17:00Z"), game("pre", "2026-10-02T00:15Z")];
    expect(weekHeadline(4, games)).toBe("Week 4 kicks off Thu 8:15 PM ET");
  });

  it("counts the games in progress while any is live", () => {
    expect(weekHeadline(4, [game("post"), game("in"), game("in"), game("in"), game("pre")])).toBe(
      "Week 4 LIVE: 3 games in progress",
    );
    expect(weekHeadline(4, [game("in"), game("pre")])).toBe("Week 4 LIVE: 1 game in progress");
  });

  it("calls the week final once every game is over", () => {
    expect(weekHeadline(3, [game("post"), game("post")])).toBe("Week 3 final");
  });

  it("names the next game in a lull between game days", () => {
    const games = [game("post", "2026-10-02T00:15Z"), game("pre", "2026-10-04T17:00Z")];
    expect(weekHeadline(4, games)).toBe("Week 4 underway, next game Sun 1:00 PM ET");
  });
});
