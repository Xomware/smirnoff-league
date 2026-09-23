import { describe, expect, it } from "vitest";

import type { SleeperTransaction } from "@/lib/sleeper/types";
import { golden, W1_POSITIONS } from "@/lib/test/league-mock";
import { headToHead, profileResults, seasonPoints, teamTransactions } from "./profile";

const positionOf = (id: string) => W1_POSITIONS[id];
const allIds = golden.weeks[0].matchups.map((m) => m.roster_id);

describe("profileResults", () => {
  it("gives roster 6 its opponent, margin, bench points left, ices and the league average each week", () => {
    const [w1, w2] = profileResults(golden.weeks, 6, positionOf);

    expect(w1).toMatchObject({ week: 1, points: 91.46, opponent: { rosterId: 9, points: 134.46 }, result: "L", margin: -43 });
    // Bench RB 8.0 and WR 3.1 beat FLEX 4.1 and WR 0.0.
    expect(w1.benchLeft).toBe(7);
    expect(w1.ices.map((i) => i.reason).sort()).toEqual(["lowest", "zero"]);
    expect(w1.leagueAvg).toBeCloseTo(130.95, 2);

    expect(w2).toMatchObject({ week: 2, opponent: { rosterId: 1 }, result: "L", margin: -67.7 });
    expect(w2.ices).toEqual([]);
    expect(w2.leagueAvg).toBeCloseTo(116.46, 2);
  });

  it("has no margin or bench figure for a bye or a week Sleeper has no lineup for", () => {
    const weeks = [
      {
        week: 1,
        matchups: [
          { roster_id: 1, matchup_id: null, points: 80, starters: null, starters_points: [], players: null, players_points: null },
          { roster_id: 2, matchup_id: 1, points: 100, starters: null, starters_points: [], players: null, players_points: null },
        ],
      },
    ];
    expect(profileResults(weeks, 1, positionOf)[0]).toMatchObject({ opponent: null, result: null, margin: null, benchLeft: null, leagueAvg: 90 });
  });
});

describe("headToHead", () => {
  it("lists every other team, the ones played first with the record and points each way", () => {
    const rows = headToHead(golden.weeks, 6, allIds);

    expect(rows).toHaveLength(13);
    expect(rows.map((r) => r.rosterId)).not.toContain(6);
    expect(rows.slice(0, 2)).toEqual([
      { rosterId: 1, wins: 0, losses: 1, ties: 0, pf: 114.98, pa: 182.68 },
      { rosterId: 9, wins: 0, losses: 1, ties: 0, pf: 91.46, pa: 134.46 },
    ]);
    expect(rows[2]).toEqual({ rosterId: 2, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 });
  });

  it("adds up two meetings with the same team", () => {
    const [row] = headToHead([golden.weeks[0], { ...golden.weeks[0], week: 2 }], 6, [6, 9]);
    expect(row).toEqual({ rosterId: 9, wins: 0, losses: 2, ties: 0, pf: 182.92, pa: 268.92 });
  });
});

describe("seasonPoints", () => {
  it("sums each player's points across every week and roster", () => {
    const points = seasonPoints(golden.weeks);
    expect(points.get("9488")).toBeCloseTo(68.7, 2);
    expect(points.get("7600")).toBe(7.4);
  });
});

const tx = (t: Partial<SleeperTransaction>): SleeperTransaction => ({
  transaction_id: "t",
  type: "free_agent",
  status: "complete",
  leg: 3,
  roster_ids: [6],
  adds: null,
  drops: null,
  draft_picks: [],
  waiver_budget: [],
  settings: null,
  creator: "u6",
  created: 1,
  status_updated: 1,
  ...t,
});

describe("teamTransactions", () => {
  it("keeps this team's completed moves, newest week first, with what came in and went out", () => {
    const rows = teamTransactions(
      [
        tx({ transaction_id: "a", leg: 2, adds: { "1": 6 }, drops: { "2": 6 } }),
        tx({ transaction_id: "failed", status: "failed", adds: { "3": 6 } }),
        tx({ transaction_id: "other", roster_ids: [4], adds: { "4": 4 } }),
        tx({
          transaction_id: "trade",
          type: "trade",
          leg: 3,
          roster_ids: [6, 9],
          adds: { "5": 6, "6": 9 },
          drops: { "5": 9, "6": 6 },
          draft_picks: [
            { season: "2027", round: 2, roster_id: 9, previous_owner_id: 9, owner_id: 6 },
            { season: "2027", round: 4, roster_id: 6, previous_owner_id: 6, owner_id: 9 },
          ],
        }),
      ],
      6,
    );

    expect(rows.map((r) => r.id)).toEqual(["trade", "a"]);
    expect(rows[0]).toMatchObject({ week: 3, type: "trade", added: ["5"], dropped: ["6"], partners: [9] });
    expect(rows[0].picksIn).toEqual([{ season: "2027", round: 2, original: 9 }]);
    expect(rows[0].picksOut).toEqual([{ season: "2027", round: 4, original: 6 }]);
    expect(rows[1]).toMatchObject({ week: 2, type: "free_agent", added: ["1"], dropped: ["2"], partners: [] });
  });
});
