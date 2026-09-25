import { describe, expect, it } from "vitest";

import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { clock, dueWeek, etDeadline, owedGroups, rowOrder } from "./ledger-weeks";

const ice = (over: Partial<LedgerIce>): LedgerIce => ({ iceId: "W02#R4#0", week: 2, rosterId: 4, reason: "zero", status: "owed", ...over });

// W1 is due Sun 09-20, W2 Sun 09-27, W3 Sun 10-04, all 13:00 EDT.
const LEDGER: Ledger = {
  ices: [
    ice({ iceId: "W01#R4#0", week: 1, status: "completed" }),
    ice({ iceId: "W01#R7#0", week: 1, rosterId: 7 }),
    ice({ iceId: "W01#R7#0#LATE1", week: 1, rosterId: 7, reason: "late", parentIceId: "W01#R7#0" }),
    ice({ iceId: "W02#R4#0" }),
    ice({ iceId: "W02#R9#0", rosterId: 9, status: "completed" }),
    ice({ iceId: "W03#R5#0", week: 3, rosterId: 5 }),
  ],
  weeks: [
    { week: 1, finalizedAt: "2026-09-15T08:00:00Z", deadlineUtc: "2026-09-20T17:00:00Z" },
    { week: 2, finalizedAt: "2026-09-22T08:00:00Z", deadlineUtc: "2026-09-27T17:00:00Z" },
    { week: 3, finalizedAt: "2026-09-29T08:00:00Z", deadlineUtc: "2026-10-04T17:00:00Z" },
  ],
  summary: [],
};
const at = (iso: string) => Date.parse(iso);

describe("dueWeek", () => {
  it("picks the newest finalized week whose deadline is still ahead", () => {
    expect(dueWeek(LEDGER, at("2026-09-30T12:00:00Z"))).toBe(3);
    const w3Open = { ...LEDGER, weeks: LEDGER.weeks.map((w) => (w.week === 3 ? { ...w, finalizedAt: null, deadlineUtc: null } : w)) };
    expect(dueWeek(w3Open, at("2026-09-25T12:00:00Z"))).toBe(2);
  });

  it("falls back to the newest finalized week once every deadline has passed", () => {
    expect(dueWeek(LEDGER, at("2026-10-05T12:00:00Z"))).toBe(3);
  });

  it("is null with no finalized week, so the view opens on the live week", () => {
    expect(dueWeek({ ...LEDGER, weeks: [{ week: 1, finalizedAt: null, deadlineUtc: null }] }, 0)).toBeNull();
    expect(dueWeek(null, 0)).toBeNull();
  });
});

describe("rowOrder", () => {
  it("puts late ices first, then owed by soonest deadline, then paid", () => {
    const now = at("2026-09-25T12:00:00Z");
    const rows = [...LEDGER.ices].sort(rowOrder(LEDGER, now)).map((i) => i.iceId);
    expect(rows).toEqual(["W01#R7#0", "W01#R7#0#LATE1", "W02#R4#0", "W03#R5#0", "W01#R4#0", "W02#R9#0"]);
  });
});

describe("owedGroups", () => {
  it("groups every unpaid ice: late first, then one group per deadline, soonest first", () => {
    const groups = owedGroups(LEDGER, at("2026-09-25T12:00:00Z"));
    expect(groups.map((g) => [g.deadline, g.ices.map((i) => i.iceId)])).toEqual([
      ["late", ["W01#R7#0", "W01#R7#0#LATE1"]],
      [at("2026-09-27T17:00:00Z"), ["W02#R4#0"]],
      [at("2026-10-04T17:00:00Z"), ["W03#R5#0"]],
    ]);
  });

  it("is empty when nobody owes", () => {
    expect(owedGroups({ ...LEDGER, ices: LEDGER.ices.filter((i) => i.status === "completed") }, 0)).toEqual([]);
  });
});

describe("clock", () => {
  const deadline = at("2026-09-27T17:00:00Z");
  it("counts down in days, then hours, then goes LATE by whole days", () => {
    expect(clock(deadline, deadline - (2 * 24 + 4) * 3_600_000)).toEqual({ level: "due", text: "2d 4h" });
    expect(clock(deadline, deadline - (3 * 60 + 12) * 60_000)).toEqual({ level: "soon", text: "3h 12m" });
    expect(clock(deadline, deadline + 26 * 3_600_000)).toEqual({ level: "late", text: "LATE 1d" });
    expect(clock(deadline, deadline + 5 * 3_600_000)).toEqual({ level: "late", text: "LATE 5h" });
    expect(clock(null, 0)).toEqual({ level: "due", text: "Owed" });
  });

  it("names the deadline in Eastern time across the fall-back", () => {
    expect(etDeadline(deadline)).toBe("Sun 1 PM ET");
    expect(etDeadline(at("2026-11-01T18:00:00Z"))).toBe("Sun 1 PM ET");
  });
});
