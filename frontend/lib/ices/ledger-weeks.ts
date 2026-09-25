import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { timeLeft, type Urgency, urgency } from "./chug-board";
import { deadlineOf, isLate } from "./ledger-stats";

const finalized = (ledger: Ledger | null) => ledger?.weeks.filter((w) => w.finalizedAt) ?? [];

/** The week whose ices come due next, else the newest finalized week; null before any week finalizes. */
export function dueWeek(ledger: Ledger | null, now: number): number | null {
  const weeks = finalized(ledger);
  const upcoming = weeks.filter((w) => w.deadlineUtc && Date.parse(w.deadlineUtc) > now);
  const pool = upcoming.length ? upcoming : weeks;
  return pool.length ? Math.max(...pool.map((w) => w.week)) : null;
}

// Late means late now: a late row, or an original still unpaid past its deadline.
export const lateNow = (ledger: Ledger, ice: LedgerIce, now: number) =>
  ice.reason === "late" || (ice.status === "owed" && isLate(ledger, ice, now));

/** Late first, then owed by soonest deadline, then paid; week and id break ties. */
export function rowOrder(ledger: Ledger, now: number) {
  const rank = (i: LedgerIce) => (i.status === "completed" ? 2 : lateNow(ledger, i, now) ? 0 : 1);
  const due = (i: LedgerIce) => deadlineOf(ledger, i.week) ?? Infinity;
  return (a: LedgerIce, b: LedgerIce) => rank(a) - rank(b) || due(a) - due(b) || a.week - b.week || a.iceId.localeCompare(b.iceId);
}

export interface OwedGroup {
  deadline: number | "late" | null;
  ices: LedgerIce[];
}

export function owedGroups(ledger: Ledger, now: number): OwedGroup[] {
  const owed = ledger.ices.filter((i) => i.status === "owed").sort(rowOrder(ledger, now));
  const groups: OwedGroup[] = [];
  for (const ice of owed) {
    const deadline = lateNow(ledger, ice, now) ? "late" : deadlineOf(ledger, ice.week);
    const last = groups.at(-1);
    if (last?.deadline === deadline) last.ices.push(ice);
    else groups.push({ deadline, ices: [ice] });
  }
  return groups;
}

export function clock(deadline: number | null, now: number): { level: Urgency; text: string } {
  if (deadline === null) return { level: "due", text: "Owed" };
  if (deadline <= now) return { level: "late", text: `LATE ${timeLeft(now - deadline).split(" ")[0]}` };
  return { level: urgency(deadline, now), text: timeLeft(deadline - now) };
}

const ET_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" });
const ET_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });

export const etDeadline = (ms: number) => `${ET_HOUR.format(ms)} ET`;
export const etDay = (ms: number) => ET_DAY.format(ms);

const ET_PARTS = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" });
const DAY = 86_400_000;

// The league's deadline hour: Sunday 13:00 in New York, whatever its offset that day.
export function nextSunday(now: number): number {
  for (let day = 0; day <= 8; day++) {
    const parts = Object.fromEntries(ET_PARTS.formatToParts(now + day * DAY).map((p) => [p.type, p.value]));
    if (parts.weekday !== "Sun") continue;
    for (const utcHour of [17, 18]) {
      const t = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), utcHour);
      const hour = ET_PARTS.formatToParts(t).find((p) => p.type === "hour")?.value;
      if (hour === "13" && t > now) return t;
    }
  }
  throw new Error("no Sunday within eight days");
}

export interface NextDue {
  week: number | null;
  deadline: number;
  /** The week's original ices, paid and owed. */
  ices: LedgerIce[];
  late: LedgerIce[];
}

export function nextDue(ledger: Ledger, now: number): NextDue {
  const order = rowOrder(ledger, now);
  const late = ledger.ices.filter((i) => i.status === "owed" && lateNow(ledger, i, now)).sort(order);
  const upcoming = finalized(ledger)
    .flatMap((w) => (w.deadlineUtc && Date.parse(w.deadlineUtc) > now ? [{ week: w.week, deadline: Date.parse(w.deadlineUtc) }] : []))
    .sort((a, b) => a.deadline - b.deadline)[0];
  if (!upcoming) return { week: null, deadline: nextSunday(now), ices: [], late };
  const ices = ledger.ices.filter((i) => i.week === upcoming.week && i.reason !== "late").sort(order);
  return { ...upcoming, ices, late };
}
