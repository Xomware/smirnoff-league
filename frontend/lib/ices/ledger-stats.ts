import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { chugsFrom, summaryCards } from "./chug-rankings";

export const deadlineOf = (ledger: Ledger, week: number): number | null => {
  const iso = ledger.weeks.find((w) => w.week === week)?.deadlineUtc;
  return iso ? Date.parse(iso) : null;
};

// A late row is late by definition; an original goes late once its week's deadline passes.
export function isLate(ledger: Ledger, ice: LedgerIce, now: number): boolean {
  if (ice.reason === "late") return true;
  const deadline = deadlineOf(ledger, ice.week);
  return deadline !== null && deadline <= now;
}

export function ledgerStats(ledger: Ledger, now: number) {
  const owed = ledger.ices.filter((i) => i.status === "owed");
  const upcoming = ledger.weeks.flatMap((w) => (w.deadlineUtc && Date.parse(w.deadlineUtc) > now ? [Date.parse(w.deadlineUtc)] : []));
  return {
    owed: owed.length,
    late: owed.filter((i) => isLate(ledger, i, now)).length,
    completed: ledger.ices.length - owed.length,
    deadline: upcoming.length ? Math.min(...upcoming) : null,
    fastest: summaryCards(chugsFrom(ledger.ices), []).fastest,
  };
}
