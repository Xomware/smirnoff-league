// The ice rule, per "Ice computation spec" in docs/features/smirnoff-league/PLAN.md.
// backend ices.py implements the same function; both must pass fixtures/ices-golden.json.
import type { SleeperMatchup } from "@/lib/sleeper/types";

export const SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"] as const;

export type MatchupRow = Pick<
  SleeperMatchup,
  "roster_id" | "matchup_id" | "points" | "starters" | "starters_points"
>;

export interface WeekSettings {
  iceRulesActive: boolean;
  lowestScope: "all" | "played";
}

export interface Ice {
  id: string;
  week: number;
  rosterId: number;
  reason: "zero" | "empty" | "lowest";
  slotIndex: number | null;
  slot: string | null;
  playerId: string | null;
  points: number;
}

export function defaultWeekSettings(week: number): WeekSettings {
  return { iceRulesActive: week <= 14, lowestScope: "all" };
}

const pad = (n: number) => String(n).padStart(2, "0");
const round2 = (n: number) => Math.round(n * 100) / 100;

export function weekIces(
  week: number,
  matchups: MatchupRow[],
  slots: readonly string[],
  settings: WeekSettings,
): Ice[] {
  if (!settings.iceRulesActive) return [];

  const ices: Ice[] = [];
  const iceId = (rosterId: number, suffix: string) => `W${pad(week)}#R${pad(rosterId)}#${suffix}`;

  for (const m of matchups) {
    slots.forEach((slot, i) => {
      const playerId = m.starters[i];
      const base = { id: iceId(m.roster_id, `S${i}`), week, rosterId: m.roster_id, slotIndex: i, slot };
      if (playerId === undefined || playerId === "0") {
        ices.push({ ...base, reason: "empty", playerId: null, points: 0 });
      } else if (m.starters_points[i] <= 0) {
        ices.push({ ...base, reason: "zero", playerId, points: m.starters_points[i] });
      }
    });
  }

  const pool = settings.lowestScope === "all" ? matchups : matchups.filter((m) => m.matchup_id !== null);
  const low = Math.min(...pool.map((m) => round2(m.points)));
  for (const m of pool) {
    if (round2(m.points) !== low) continue;
    ices.push({
      id: iceId(m.roster_id, "LOWEST"),
      week,
      rosterId: m.roster_id,
      reason: "lowest",
      slotIndex: null,
      slot: null,
      playerId: null,
      points: low,
    });
  }

  // Code-point order, matching Python's sorted() in the fixture builder.
  return ices.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
