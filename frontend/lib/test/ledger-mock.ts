import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { defaultWeekSettings, SLOTS, weekIces } from "@/lib/ices/compute";
import { golden } from "./league-mock";

const stored = (week: number): LedgerIce[] =>
  weekIces(week, golden.weeks[week - 1].matchups, SLOTS, defaultWeekSettings(week)).map(({ id, ...ice }) => ({
    ...ice,
    iceId: id,
    status: "owed",
  }));

const w1 = stored(1).map((ice): LedgerIce => ({ ...ice, status: "completed", completedAt: "2026-09-19T20:00:00+00:00" }));
const w2 = stored(2);
const late = w2.map(
  (ice): LedgerIce => ({ iceId: `${ice.iceId}#LATE1`, week: 2, rosterId: ice.rosterId, reason: "late", status: "owed", parentIceId: ice.iceId }),
);

const zero = { owed: 0, completed: 0, late: 0, lateOwed: 0, overdue: 0 };

// W1's five ices paid on time; W2's three unpaid and a week late each (roster 13 owes two of them).
export const SCENARIO_LEDGER: Ledger = {
  ices: [...w1, ...w2, ...late],
  weeks: [
    { week: 1, finalizedAt: "2026-09-15T08:00:00+00:00", deadlineUtc: "2026-09-20T17:00:00+00:00" },
    { week: 2, finalizedAt: "2026-09-22T08:00:00+00:00", deadlineUtc: "2026-09-27T17:00:00+00:00" },
  ],
  summary: [
    { ...zero, rosterId: 2, completed: 1 },
    { ...zero, rosterId: 6, completed: 2 },
    { ...zero, rosterId: 8, completed: 1 },
    { rosterId: 12, owed: 1, completed: 1, late: 1, lateOwed: 1, overdue: 1 },
    { rosterId: 13, owed: 2, completed: 0, late: 2, lateOwed: 2, overdue: 2 },
  ],
};
