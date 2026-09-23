import { describe, expect, it } from "vitest";

import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { chugBoard, countdown, myDue, urgency } from "./chug-board";

const ms = (iso: string) => Date.parse(iso);
const HOUR = 3_600_000;

const ice = (over: Partial<LedgerIce>): LedgerIce => ({ iceId: "W02#R4#0", week: 2, rosterId: 4, reason: "zero", status: "owed", ...over });

// W2's deadline is Sun 2026-09-27 13:00 EDT; W9's is Sun 2026-11-01 13:00 EST, hours after fall-back.
const LEDGER: Ledger = {
  ices: [
    ice({ iceId: "W01#R4#0", week: 1, status: "completed", videoId: "v1" }),
    ice({ iceId: "W01#R7#0", week: 1, rosterId: 7, status: "completed" }),
    ice({}),
    ice({ iceId: "W02#R4#1", reason: "lowest", status: "completed" }),
    ice({ iceId: "W02#R7#0", rosterId: 7 }),
    ice({ iceId: "W02#R9#0", rosterId: 9, status: "completed" }),
    ice({ iceId: "W02#R9#0#LATE1", rosterId: 9, reason: "late", parentIceId: "W02#R9#0" }),
  ],
  weeks: [
    { week: 1, finalizedAt: "2026-09-15T08:00:00+00:00", deadlineUtc: "2026-09-20T17:00:00+00:00" },
    { week: 2, finalizedAt: "2026-09-22T08:00:00+00:00", deadlineUtc: "2026-09-27T17:00:00+00:00" },
  ],
  summary: [],
};

describe("chugBoard", () => {
  it("groups the originals in play by team, owing teams first, late rows as counts", () => {
    const board = chugBoard(LEDGER);
    expect(board.map((t) => t.rosterId)).toEqual([4, 7, 9]);
    expect(board[0].ices.map((r) => r.ice.iceId)).toEqual(["W01#R4#0", "W02#R4#0", "W02#R4#1"]);
    expect(board[0].ices[1]).toMatchObject({ deadline: ms("2026-09-27T17:00:00Z"), late: 0 });
    expect(board[2].ices).toEqual([expect.objectContaining({ late: 1 })]);
  });

  it("drops completed ices older than last week but keeps anything still owed", () => {
    const old = ice({ iceId: "W01#R5#0", week: 1, rosterId: 5 });
    const w3 = { week: 3, finalizedAt: "2026-09-29T08:00:00+00:00", deadlineUtc: "2026-10-04T17:00:00+00:00" };
    const board = chugBoard({ ...LEDGER, ices: [...LEDGER.ices, old], weeks: [...LEDGER.weeks, w3] });
    const ids = board.flatMap((t) => t.ices.map((r) => r.ice.iceId));
    expect(ids).toContain("W01#R5#0");
    expect(ids).not.toContain("W01#R4#0");
    expect(ids).not.toContain("W01#R7#0");
  });
});

describe("countdown", () => {
  const due = ms("2026-09-27T17:00:00Z");

  it.each([
    ["2026-09-25T22:00:00Z", "due in 1d 19h"],
    ["2026-09-25T12:00:00Z", "due in 2d 5h"],
    ["2026-09-27T12:30:00Z", "due in 4h 30m"],
    ["2026-09-27T16:13:00Z", "due in 47m 0s"],
    ["2026-09-27T16:59:58Z", "due in 0m 2s"],
    ["2026-09-27T17:00:00Z", "LATE"],
  ])("at %s reads %s", (now, text) => {
    expect(countdown(due, ms(now), 0)).toBe(text);
  });

  it("counts late rows once they exist", () => {
    expect(countdown(due, due + HOUR, 2)).toBe("LATE +2");
  });

  it("counts real hours across the fall-back, not wall-clock ones", () => {
    // Fri 18:00 EDT to Sun 13:00 EST is 43 wall-clock hours but 44 real ones.
    expect(countdown(ms("2026-11-01T18:00:00Z"), ms("2026-10-30T22:00:00Z"), 0)).toBe("due in 1d 20h");
    expect(countdown(ms("2026-11-01T18:00:00Z"), ms("2026-11-01T05:30:00Z"), 0)).toBe("due in 12h 30m");
  });
});

describe("urgency", () => {
  const due = ms("2026-09-27T17:00:00Z");
  it("is due, then soon under 24h, then late", () => {
    expect(urgency(due, due - 24 * HOUR - 1)).toBe("due");
    expect(urgency(due, due - 24 * HOUR)).toBe("soon");
    expect(urgency(due, due - 1)).toBe("soon");
    expect(urgency(due, due)).toBe("late");
  });
});

describe("myDue", () => {
  const now = ms("2026-09-25T22:00:00Z");

  it("counts my owed rows against the nearest deadline", () => {
    expect(myDue(LEDGER, 4, now)).toEqual({ count: 1, deadline: ms("2026-09-27T17:00:00Z"), level: "due", iceIds: ["W02#R4#0"], when: "due in 1d 19h", text: "You owe 1 ice · due in 1d 19h" });
    expect(myDue(LEDGER, 4, ms("2026-09-27T10:00:00Z"))?.level).toBe("soon");
  });

  it("is late when a late row is owed, even with its original paid", () => {
    expect(myDue(LEDGER, 9, now)).toMatchObject({ count: 1, level: "late", text: "You owe 1 ice · LATE" });
  });

  it("is late once an original passes its deadline, before the late row lands", () => {
    expect(myDue(LEDGER, 4, ms("2026-09-27T17:05:00Z"))).toMatchObject({ level: "late", text: "You owe 1 ice · LATE" });
  });

  it("is null when I owe nothing or have no team", () => {
    expect(myDue(LEDGER, 2, now)).toBeNull();
    expect(myDue(LEDGER, null, now)).toBeNull();
  });
});
