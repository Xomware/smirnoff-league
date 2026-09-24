import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/espn";
import type { Player } from "@/lib/league/use-league";
import { golden } from "@/lib/test/league-mock";
import { defaultWeekSettings, type MatchupRow, SLOTS, weekIces } from "./compute";
import { watchStates } from "./watch";

function game(teams: string[], patch: Partial<Game> = {}): Game {
  return {
    id: teams.join("@"),
    kickoff: "2026-09-27T17:00Z",
    state: "in",
    status: "STATUS_IN_PROGRESS",
    period: 1,
    clock: "15:00",
    completed: false,
    teams,
    ...patch,
  };
}

const pre = (teams: string[]) => game(teams, { state: "pre", status: "STATUS_SCHEDULED", period: 0 });
const final = (teams: string[]) => game(teams, { state: "post", status: "STATUS_FINAL", period: 4, clock: "0:00", completed: true });

const player = (team: string | null, injury_status: string | null = null): Player => ({
  name: "Someone",
  position: "WR",
  team,
  injury_status,
});

// Roster 1 starts "p" in slot 3 on `team`, everyone else on SAFE team SEA.
function stateOf(points: number, games: Game[], p: Player, playerId = "p"): string {
  const starters = SLOTS.map((_, i) => `s${i}`);
  starters[3] = playerId;
  const starters_points = SLOTS.map(() => 10);
  starters_points[3] = points;
  const row: MatchupRow = { roster_id: 1, matchup_id: 1, points: 100, starters, starters_points };
  const players: Record<string, Player> = { p, ...Object.fromEntries(starters.slice(0, 3).map((id) => [id, player("SEA")])) };
  return watchStates(3, [row], games, players)[0].starters[3].state;
}

describe("watchStates", () => {
  it("locks an empty slot once every game has kicked off", () => {
    expect(stateOf(0, [game(["BUF", "MIA"])], player("BUF"), "0")).toBe("LOCKED");
  });

  it("leaves an empty slot open while any game has yet to kick off", () => {
    expect(stateOf(0, [pre(["BUF", "MIA"])], player("BUF"), "0")).toBe("OPEN");
    expect(stateOf(0, [final(["BUF", "MIA"]), pre(["KC", "DEN"])], player("BUF"), "0")).toBe("OPEN");
  });

  it("never locks an empty slot without a scoreboard", () => {
    expect(stateOf(0, [], player("BUF"), "0")).toBe("OPEN");
  });

  it("locks a player on bye once every game has kicked off", () => {
    expect(stateOf(0, [game(["BUF", "MIA"])], player("KC"))).toBe("LOCKED");
  });

  it("leaves a player on bye open while another game has yet to kick off", () => {
    expect(stateOf(0, [final(["BUF", "MIA"]), pre(["SEA", "LAR"])], player("KC"))).toBe("OPEN");
  });

  it.each(["Out", "IR", "PUP", "Sus"])("leaves a starter listed %s open before his kickoff", (status) => {
    expect(stateOf(0, [pre(["BUF", "MIA"])], player("BUF", status))).toBe("OPEN");
  });

  it("locks in a sidelined starter once his own game kicks off, even with other games pending", () => {
    expect(stateOf(0, [game(["BUF", "MIA"], { clock: "5:00" }), pre(["SEA", "LAR"])], player("BUF", "Out"))).toBe("SAFE");
  });

  it("ices a sidelined starter left in once his game is over", () => {
    expect(stateOf(0, [final(["BUF", "MIA"]), pre(["SEA", "LAR"])], player("BUF", "Out"))).toBe("FINAL_ICE");
  });

  it("ignores injury status once the game has kicked off", () => {
    expect(stateOf(12, [game(["BUF", "MIA"])], player("BUF", "IR"))).toBe("SAFE");
  });

  it("keeps a Questionable starter safe before kickoff", () => {
    expect(stateOf(0, [game(["BUF", "MIA"], { state: "pre", status: "STATUS_SCHEDULED", period: 0 })], player("BUF", "Questionable"))).toBe(
      "SAFE",
    );
  });

  it("is safe under 1.0 before halftime", () => {
    expect(stateOf(0, [game(["BUF", "MIA"], { period: 2 })], player("BUF"))).toBe("SAFE");
  });

  it("watches under 1.0 at halftime and later", () => {
    expect(stateOf(0.4, [game(["BUF", "MIA"], { period: 2, status: "STATUS_HALFTIME" })], player("BUF"))).toBe("WATCH");
    expect(stateOf(0.4, [game(["BUF", "MIA"], { period: 3 })], player("BUF"))).toBe("WATCH");
    expect(stateOf(0.9, [game(["BUF", "MIA"], { period: 5 })], player("BUF"))).toBe("WATCH");
  });

  it("is safe at 1.0 or more after halftime", () => {
    expect(stateOf(1, [game(["BUF", "MIA"], { period: 4 })], player("BUF"))).toBe("SAFE");
  });

  it("ices a finished starter at zero or below and clears one above", () => {
    expect(stateOf(0, [final(["BUF", "MIA"])], player("BUF"))).toBe("FINAL_ICE");
    expect(stateOf(-1, [final(["BUF", "MIA"])], player("BUF"))).toBe("FINAL_ICE");
    expect(stateOf(0.1, [final(["BUF", "MIA"])], player("BUF"))).toBe("FINAL_SAFE");
  });

  it("finds a defense by its team-abbreviation id", () => {
    expect(stateOf(0, [final(["BUF", "MIA"])], player("BUF"), "BUF")).toBe("FINAL_ICE");
  });

  it("counts locked, open, watch and final ices per team", () => {
    const row: MatchupRow = {
      roster_id: 4,
      matchup_id: 1,
      points: 50,
      starters: ["a", "b", "c", "0", ...SLOTS.slice(4).map((_, i) => `z${i}`)],
      starters_points: [0, 0.2, 5, 0, ...SLOTS.slice(4).map(() => 10)],
    };
    const players = { a: player("BUF"), b: player("SEA"), c: player("SEA") };
    const teams = watchStates(3, [row], [final(["BUF", "MIA"]), game(["SEA", "LAR"], { period: 3 })], players);
    // z* have no team, so they count as on bye.
    expect(teams[0]).toMatchObject({ rosterId: 4, finalIce: 1, watch: 1, locked: 1 + 6, open: 0 });

    const early = watchStates(3, [row], [final(["BUF", "MIA"]), game(["SEA", "LAR"], { period: 3 }), pre(["KC", "DEN"])], players);
    expect(early[0]).toMatchObject({ finalIce: 1, watch: 1, locked: 0, open: 1 + 6 });
  });

  it("skips rosters Sleeper has no lineup for", () => {
    const row: MatchupRow = { roster_id: 9, matchup_id: 1, points: 0, starters: null, starters_points: [] };
    expect(watchStates(3, [row], [], {})).toEqual([]);
  });
});

describe("at FINAL", () => {
  it("matches weekIces' zero and empty ices on the golden weeks", () => {
    for (const { week, matchups } of golden.weeks) {
      const players: Record<string, Player> = {};
      for (const m of matchups) for (const id of m.starters ?? []) players[id] = player(/^[A-Z]+$/.test(id) ? id : "BUF");
      const games = [final(["BUF", "MIA"]), ...Object.values(players).map((p) => final([p.team!]))];

      const iced = watchStates(week, matchups, games, players)
        .flatMap((t) => t.starters)
        .filter((s) => s.state === "FINAL_ICE" || s.state === "LOCKED")
        .map((s) => s.id);
      const expected = weekIces(week, matchups, SLOTS, defaultWeekSettings(week))
        .filter((i) => i.reason !== "lowest")
        .map((i) => i.id);

      expect(expected.length).toBeGreaterThan(0);
      expect(iced.sort()).toEqual(expected.sort());
    }
  });
});
