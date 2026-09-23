import type { LedgerSummary } from "@/lib/api/ledger";
import type { Game } from "@/lib/espn";
import { defaultWeekSettings, type MatchupRow, SLOTS, weekIces } from "./compute";

export type Trouble = "late" | "owe" | "lowest";

export function troubleByRoster(summary: LedgerSummary[], lowest: number[]): Map<number, Trouble[]> {
  const map = new Map<number, Trouble[]>();
  for (const s of summary) {
    if (s.lateOwed > 0 || s.overdue > 0) map.set(s.rosterId, ["late"]);
    else if (s.owed > 0) map.set(s.rosterId, ["owe"]);
  }
  for (const id of lowest) map.set(id, [...(map.get(id) ?? []), "lowest"]);
  return map;
}

// The same rule the week's final tally applies, so ties and weeks without ice rules match it.
export function liveLowest(week: number, matchups: MatchupRow[], games: Game[]): number[] {
  if (!games.some((g) => g.state === "in")) return [];
  return weekIces(week, matchups, SLOTS, defaultWeekSettings(week))
    .filter((i) => i.reason === "lowest")
    .map((i) => i.rosterId);
}
