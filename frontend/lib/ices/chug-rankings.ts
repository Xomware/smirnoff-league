import type { LedgerIce } from "@/lib/api/ledger";

export interface Chug {
  iceId: string;
  week: number;
  rosterId: number;
  seconds: number;
  /** Null when nobody was named; the team stands in. */
  name: string | null;
  timedAt?: string;
}

export interface Ranked {
  rank: number;
  tied: boolean;
}

export interface ChuggerRow extends Ranked {
  key: string;
  name: string | null;
  /** The team of their latest chug. */
  rosterId: number;
  pr: number;
  avg: number;
  count: number;
  /** Oldest first. */
  chugs: Chug[];
}

export type SortKey = "rank" | "chugger" | "team" | "pr" | "avg" | "count";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

// Times are stored in tenths, so summing whole tenths keeps averages exact:
// 18.9 / 2 is 9.45 in decimal but 9.4499... as a float, and should show 9.5.
const tenths = (seconds: number) => Math.round(seconds * 10);
const mean = (chugs: Chug[]) => Math.round(chugs.reduce((sum, c) => sum + tenths(c.seconds), 0) / chugs.length) / 10;
const chronological = (a: Chug, b: Chug) =>
  a.week - b.week || (a.timedAt ?? "").localeCompare(b.timedAt ?? "") || a.iceId.localeCompare(b.iceId);

export const chugsFrom = (ices: LedgerIce[]): Chug[] =>
  ices.flatMap((i) =>
    i.chugSeconds === undefined
      ? []
      : [{ iceId: i.iceId, week: i.week, rosterId: i.rosterId, seconds: i.chugSeconds, name: i.chugger?.name ?? null, timedAt: i.timedAt }],
  );

export const chugWeeks = (chugs: Chug[]) => [...new Set(chugs.map((c) => c.week))].sort((a, b) => a - b);

export const rankLabel = ({ rank, tied }: Ranked) => (tied ? `Tied-${rank}` : String(rank));

// Competition ranking: equals share a rank and the next rank skips past them (1, 1, 3).
function rank<T>(rows: T[], cmp: (a: T, b: T) => number, order: (a: T, b: T) => number): (T & Ranked)[] {
  const sorted = [...rows].sort((a, b) => cmp(a, b) || order(a, b));
  return sorted.map((row) => {
    const equal = sorted.filter((other) => cmp(other, row) === 0);
    return { ...row, rank: sorted.indexOf(equal[0]) + 1, tied: equal.length > 1 };
  });
}

export function chuggerRankings(chugs: Chug[]): ChuggerRow[] {
  const groups = new Map<string, Chug[]>();
  for (const c of [...chugs].sort(chronological)) {
    const key = c.name === null ? `team:${c.rosterId}` : `name:${c.name}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const rows = [...groups].map(([key, list]) => ({
    key,
    name: list[0].name,
    rosterId: list[list.length - 1].rosterId,
    pr: Math.min(...list.map((c) => c.seconds)),
    avg: mean(list),
    count: list.length,
    chugs: list,
  }));
  return rank(rows, (a, b) => a.pr - b.pr || a.avg - b.avg || b.count - a.count, (a, b) => a.key.localeCompare(b.key));
}

export const weekRankings = (chugs: Chug[], week: number) =>
  rank(
    chugs.filter((c) => c.week === week),
    (a, b) => a.seconds - b.seconds,
    (a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.iceId.localeCompare(b.iceId),
  );

export function summaryCards(chugs: Chug[], rows: ChuggerRow[]) {
  const improved = rows
    .filter((r) => r.count >= 2)
    .map((row) => {
      const first = row.chugs[0].seconds;
      const latest = row.chugs[row.chugs.length - 1].seconds;
      return { row, first, latest, drop: (tenths(first) - tenths(latest)) / 10 };
    })
    .filter((r) => r.drop > 0)
    .sort((a, b) => b.drop - a.drop)[0];
  return {
    fastest: [...chugs].sort((a, b) => a.seconds - b.seconds || chronological(a, b))[0] ?? null,
    average: chugs.length ? mean(chugs) : null,
    count: chugs.length,
    improved: improved ?? null,
    slowest: rows.length ? [...rows].sort((a, b) => b.avg - a.avg || a.rank - b.rank)[0] : null,
  };
}

export function sortRankings(rows: ChuggerRow[], sort: Sort, label: (row: ChuggerRow) => string, team: (rosterId: number) => string) {
  const by: Record<SortKey, (a: ChuggerRow, b: ChuggerRow) => number> = {
    rank: (a, b) => a.rank - b.rank,
    chugger: (a, b) => label(a).localeCompare(label(b)),
    team: (a, b) => team(a.rosterId).localeCompare(team(b.rosterId)),
    pr: (a, b) => a.pr - b.pr,
    avg: (a, b) => a.avg - b.avg,
    count: (a, b) => a.count - b.count,
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * by[sort.key](a, b));
}
