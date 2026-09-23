import type { Ledger, LedgerSummary } from "@/lib/api/ledger";
import type { Ice, MatchupRow } from "./compute";
import { iceStreaks, type StatsMatchup } from "./stats";
import type { SeasonTally, WeekIces } from "./tally";

export interface IceStanding {
  rosterId: number;
  rank: number;
  total: number;
  reasons: Record<Ice["reason"], number>;
  /** Season view only. */
  streak: number | null;
  worst: { week: number; count: number } | null;
  /** Week view only; the result is null while the week is live or on a bye. */
  score: { points: number; result: "W" | "L" | "T" | null } | null;
  /** Null without the ledger, or for a week it hasn't recorded. */
  completed: number | null;
  late: number | null;
}

export type StandingsMode = "season" | "week";

export type SortKey =
  | "rank"
  | "team"
  | "total"
  | "completed"
  | "late"
  | "zero"
  | "empty"
  | "lowest"
  | "streak"
  | "worst"
  | "score"
  | "result";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: Sort = { key: "rank", dir: "asc" };

const MODE_ONLY: Record<StandingsMode, SortKey[]> = { season: ["streak", "worst"], week: ["score", "result"] };

// The caller keeps one sort across views; a column this view lacks ranks by default
// until the user switches back to the view that has it.
export function sortFor(sort: Sort, mode: StandingsMode): Sort {
  return MODE_ONLY[mode === "season" ? "week" : "season"].includes(sort.key) ? DEFAULT_SORT : sort;
}

// Shame order: most ices first, then fewest points-for, since the worse team deserves the top spot.
export function iceStandings(
  tally: SeasonTally,
  finishedWeeks: { week: number; matchups: StatsMatchup[] }[],
  pf: Record<number, number>,
  summary: LedgerSummary[] | null,
): IceStanding[] {
  const streaks = new Map(iceStreaks(finishedWeeks).map((s) => [s.rosterId, s.current]));
  return [...tally.owed]
    .sort((a, b) => b.total - a.total || (pf[a.rosterId] ?? 0) - (pf[b.rosterId] ?? 0) || a.rosterId - b.rosterId)
    .map((t, i) => {
      // Earliest week wins a tie for worst.
      const worst = Object.entries(t.byWeek)
        .map(([week, count]) => ({ week: Number(week), count }))
        .sort((a, b) => b.count - a.count || a.week - b.week)[0];
      return {
        rosterId: t.rosterId,
        rank: i + 1,
        total: t.total,
        reasons: t.reasons,
        streak: streaks.get(t.rosterId) ?? 0,
        worst: worst ?? null,
        score: null,
        completed: summary && (summary.find((s) => s.rosterId === t.rosterId)?.completed ?? 0),
        late: summary && (summary.find((s) => s.rosterId === t.rosterId)?.late ?? 0),
      };
    });
}

// Same shame order within one week: most ices, then the lowest score that week.
export function weekIceStandings(
  rosterIds: number[],
  { week, ices }: WeekIces,
  matchups: MatchupRow[],
  live: boolean,
  ledger: Pick<Ledger, "ices" | "weeks"> | null,
): IceStanding[] {
  const recorded = ledger?.weeks.some((w) => w.week === week) ? ledger.ices.filter((i) => i.week === week) : null;
  const score = (rosterId: number): IceStanding["score"] => {
    const mine = matchups.find((m) => m.roster_id === rosterId);
    if (!mine) return null;
    const opp = mine.matchup_id === null ? undefined : matchups.find((m) => m.matchup_id === mine.matchup_id && m !== mine);
    const result = live || !opp ? null : mine.points > opp.points ? "W" : mine.points < opp.points ? "L" : "T";
    return { points: mine.points, result };
  };
  return rosterIds
    .map((rosterId) => {
      const own = ices.filter((i) => i.rosterId === rosterId);
      const reasons = { zero: 0, empty: 0, lowest: 0 };
      for (const ice of own) reasons[ice.reason] += 1;
      const logged = recorded?.filter((i) => i.rosterId === rosterId);
      return {
        rosterId,
        total: own.length,
        reasons,
        streak: null,
        worst: null,
        score: score(rosterId),
        completed: logged ? logged.filter((i) => i.reason !== "late" && i.status === "completed").length : null,
        late: logged ? logged.filter((i) => i.reason === "late").length : null,
      };
    })
    .sort((a, b) => b.total - a.total || (a.score?.points ?? 0) - (b.score?.points ?? 0) || a.rosterId - b.rosterId)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const RESULT_ORDER = { W: 3, T: 2, L: 1 };

export function toggleSort(sort: Sort, key: SortKey): Sort {
  if (sort.key === key) return { key, dir: sort.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "rank" || key === "team" ? "asc" : "desc" };
}

export function sortRows(rows: IceStanding[], sort: Sort, nameOf: (rosterId: number) => string): IceStanding[] {
  const value = (r: IceStanding): number | string => {
    switch (sort.key) {
      case "team":
        return nameOf(r.rosterId);
      case "zero":
      case "empty":
      case "lowest":
        return r.reasons[sort.key];
      case "worst":
        return r.worst?.count ?? 0;
      case "completed":
      case "late":
      case "streak":
        return r[sort.key] ?? 0;
      case "score":
        return r.score?.points ?? 0;
      case "result":
        return r.score?.result ? RESULT_ORDER[r.score.result] : 0;
      default:
        return r[sort.key];
    }
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const cmp = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
    return sign * cmp || a.rank - b.rank;
  });
}

export interface SeasonGrid {
  columns: { week: number; live: boolean }[];
  rows: { rosterId: number; counts: number[] }[];
  totals: number[];
}

// The live column counts only locked (empty-slot) ices; tally.live is already built that way.
export function seasonGrid(rosterIds: number[], tally: SeasonTally): SeasonGrid {
  const weeks = [...tally.weeks.map((w) => ({ ...w, live: false })), ...(tally.live ? [{ ...tally.live, live: true }] : [])];
  const count = (ices: Ice[], rosterId: number) => ices.filter((i) => i.rosterId === rosterId).length;
  return {
    columns: weeks.map(({ week, live }) => ({ week, live })),
    rows: rosterIds.map((rosterId) => ({ rosterId, counts: weeks.map((w) => count(w.ices, rosterId)) })),
    totals: weeks.map((w) => w.ices.length),
  };
}
