import type { Ledger, LedgerIce } from "@/lib/api/ledger";

export type Urgency = "due" | "soon" | "late";

export interface BoardIce {
  ice: LedgerIce;
  deadline: number | null;
  /** Late rows this original has generated so far. */
  late: number;
}

export interface BoardTeam {
  rosterId: number;
  ices: BoardIce[];
}

export interface MyDue {
  count: number;
  deadline: number | null;
  level: Urgency;
  iceIds: string[];
  /** "due in 1d 19h", "LATE", or null when no deadline is known. */
  when: string | null;
  text: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const deadlines = (ledger: Ledger) =>
  new Map(ledger.weeks.map((w) => [w.week, w.deadlineUtc ? Date.parse(w.deadlineUtc) : null]));

/** The newest finalized week; the board and reel show it and the one before. */
export const currentWeek = (ledger: Ledger) => Math.max(0, ...ledger.weeks.filter((w) => w.finalizedAt).map((w) => w.week));

export function chugBoard(ledger: Ledger): BoardTeam[] {
  const due = deadlines(ledger);
  const since = currentWeek(ledger) - 1;
  const late = ledger.ices.filter((i) => i.reason === "late");
  const teams = new Map<number, BoardIce[]>();
  for (const ice of ledger.ices) {
    if (ice.reason === "late" || (ice.status === "completed" && ice.week < since)) continue;
    const row = { ice, deadline: due.get(ice.week) ?? null, late: late.filter((l) => l.parentIceId === ice.iceId).length };
    teams.set(ice.rosterId, [...(teams.get(ice.rosterId) ?? []), row]);
  }
  const owing = (rosterId: number) => ledger.ices.filter((i) => i.rosterId === rosterId && i.status === "owed").length;
  return [...teams]
    .map(([rosterId, ices]) => ({ rosterId, ices: ices.sort((a, b) => a.ice.week - b.ice.week || a.ice.iceId.localeCompare(b.ice.iceId)) }))
    .sort((a, b) => owing(b.rosterId) - owing(a.rosterId) || a.rosterId - b.rosterId);
}

// Real elapsed time, so a countdown across the fall-back runs an hour longer
// than the wall clock suggests.
export function countdown(deadline: number, now: number, late: number): string {
  const left = deadline - now;
  if (left <= 0) return late ? `LATE +${late}` : "LATE";
  const d = Math.floor(left / DAY);
  const h = Math.floor((left % DAY) / HOUR);
  const m = Math.floor((left % HOUR) / MINUTE);
  if (d) return `due in ${d}d ${h}h`;
  if (h) return `due in ${h}h ${m}m`;
  return `due in ${m}m ${Math.floor((left % MINUTE) / 1000)}s`;
}

export function urgency(deadline: number, now: number): Urgency {
  if (now >= deadline) return "late";
  return deadline - now <= DAY ? "soon" : "due";
}

export function myDue(ledger: Ledger, rosterId: number | null, now: number): MyDue | null {
  const owed = ledger.ices.filter((i) => i.rosterId === rosterId && i.status === "owed");
  if (!owed.length) return null;
  const due = deadlines(ledger);
  const originals = owed.flatMap((i) => (i.reason === "late" ? [] : [due.get(i.week) ?? null]));
  const late = originals.length < owed.length || originals.some((d) => d !== null && d <= now);
  const deadline = Math.min(...originals.filter((d) => d !== null));
  const known = Number.isFinite(deadline) ? deadline : null;
  const level = late ? "late" : known === null ? "due" : urgency(known, now);
  const when = level === "late" ? "LATE" : known === null ? null : countdown(known, now, 0);
  const text = `You owe ${owed.length} ${owed.length === 1 ? "ice" : "ices"}${when ? ` · ${when}` : ""}`;
  return { count: owed.length, deadline: known, level, iceIds: owed.map((i) => i.iceId), when, text };
}
