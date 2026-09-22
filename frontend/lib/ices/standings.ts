import type { Ice } from "./compute";
import { iceStreaks, type StatsMatchup } from "./stats";
import type { SeasonTally } from "./tally";

export interface IceStanding {
  rosterId: number;
  rank: number;
  total: number;
  reasons: Record<Ice["reason"], number>;
  streak: number;
  worst: { week: number; count: number } | null;
}

export type SortKey = "rank" | "team" | "total" | "zero" | "empty" | "lowest" | "streak" | "worst";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: Sort = { key: "rank", dir: "asc" };

// Shame order: most ices first, then fewest points-for, since the worse team deserves the top spot.
export function iceStandings(
  tally: SeasonTally,
  finishedWeeks: { week: number; matchups: StatsMatchup[] }[],
  pf: Record<number, number>,
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
      };
    });
}

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
