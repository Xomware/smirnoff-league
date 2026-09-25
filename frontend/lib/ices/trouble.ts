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

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZoneName: "shortOffset",
});

// 4 PM ET on the week's Sunday, or null when no Sunday game is scheduled.
function sundayFourPm(games: Game[]): number | null {
  for (const g of games) {
    const t = Date.parse(g.kickoff);
    if (Number.isNaN(t)) continue;
    const p = Object.fromEntries(ET.formatToParts(t).map((x) => [x.type, x.value]));
    if (p.weekday !== "Sun") continue;
    const offset = Number(p.timeZoneName.replace("GMT", "") || 0);
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 16 - offset);
  }
  return null;
}

// The same rule the week's final tally applies, so ties and weeks without ice rules match it.
// Held back until 4 PM ET Sunday: before then most teams have barely played, and a
// handful of 0.00 scores all tie for lowest.
export function liveLowest(week: number, matchups: MatchupRow[], games: Game[], now = Date.now()): number[] {
  if (!games.some((g) => g.state === "in")) return [];
  const from = sundayFourPm(games);
  if (from === null || now < from) return [];
  return weekIces(week, matchups, SLOTS, defaultWeekSettings(week))
    .filter((i) => i.reason === "lowest")
    .map((i) => i.rosterId);
}
