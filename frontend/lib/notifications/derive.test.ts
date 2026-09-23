import { describe, expect, it } from "vitest";

import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { deriveNotifications, type NotificationSources, unreadCount } from "./derive";

const ME = 4;
const ms = (iso: string) => Date.parse(iso);

const ice = (over: Partial<LedgerIce>): LedgerIce => ({
  iceId: "W03#4#0",
  week: 3,
  rosterId: ME,
  reason: "zero",
  status: "owed",
  ...over,
});

// W3's deadline is Sunday 2026-10-04 13:00 EDT. W9's is Sunday 2026-11-01 13:00
// EST, hours after the clocks fall back, so its Friday midnight is still EDT.
const LEDGER: Ledger = {
  ices: [
    ice({ iceId: "W02#4#1", week: 2, reason: "lowest", status: "completed" }),
    ice({ iceId: "W02#4#1#LATE1", week: 2, reason: "late", parentIceId: "W02#4#1", status: "completed" }),
    ice({}),
    ice({ iceId: "W03#9#0", rosterId: 9 }),
    ice({ iceId: "W09#4#0", week: 9 }),
  ],
  weeks: [
    { week: 2, finalizedAt: "2026-09-22T08:00:00+00:00", deadlineUtc: "2026-09-27T17:00:00+00:00" },
    { week: 3, finalizedAt: null, deadlineUtc: "2026-10-04T17:00:00+00:00" },
    { week: 9, finalizedAt: "2026-10-27T08:00:00+00:00", deadlineUtc: "2026-11-01T18:00:00+00:00" },
  ],
  summary: [],
};

const WRITEUP: Writeup = { mediaId: "wu1", week: 2, title: "The Week 2 Edition", publishedAt: "2026-09-24T15:00:00+00:00", pages: [] };

const video = (over: Partial<Video>): Video => ({
  mediaId: "v1",
  iceId: "W02#9#0",
  week: 2,
  rosterId: 9,
  uploaderName: "Uploader",
  createdAt: "2026-09-23T02:00:00+00:00",
  bytes: 1,
  url: "",
  ...over,
});

const trade = (over: Partial<SleeperTransaction>): SleeperTransaction => ({
  transaction_id: "t1",
  type: "trade",
  status: "complete",
  leg: 3,
  roster_ids: [ME, 7],
  adds: null,
  drops: null,
  draft_picks: [],
  waiver_budget: [],
  settings: null,
  creator: "u",
  created: ms("2026-09-24T20:00:00Z"),
  status_updated: ms("2026-09-24T21:00:00Z"),
  ...over,
});

const sources = (over: Partial<NotificationSources> = {}): NotificationSources => ({
  myRosterId: ME,
  ledger: LEDGER,
  writeups: [WRITEUP],
  videos: [video({}), video({ mediaId: "v2", rosterId: ME, createdAt: "2026-09-23T03:00:00+00:00" })],
  transactions: [
    trade({}),
    trade({ transaction_id: "t2", roster_ids: [2, 7] }),
    trade({ transaction_id: "t3", status: "failed" }),
    trade({ transaction_id: "t4", type: "free_agent", roster_ids: [ME] }),
  ],
  teamName: (r) => `Team ${r}`,
  now: ms("2026-09-30T12:00:00Z"),
  ...over,
});

const ids = (s: NotificationSources) => deriveNotifications(s).map((n) => n.id);

describe("deriveNotifications", () => {
  it("builds each kind for my roster, newest first, with drill targets", () => {
    expect(deriveNotifications(sources())).toEqual([
      // Unfinalized W3 falls back to its deadline minus six days.
      { id: "iced:W03#4#0", kind: "iced", at: ms("2026-09-28T17:00:00Z"), title: "You got iced", body: "Week 3: a starter scored zero", target: { kind: "team", rosterId: ME } },
      { id: "late:W02#4#1#LATE1", kind: "late", at: ms("2026-09-27T17:00:00Z"), title: "Late ice added", body: "Week 2's ice missed the deadline", target: { kind: "ices" } },
      { id: "trade:t1", kind: "trade", at: ms("2026-09-24T21:00:00Z"), title: "Trade completed", body: "You traded with Team 7", target: { kind: "news" } },
      { id: "edition:wu1", kind: "edition", at: ms("2026-09-24T15:00:00Z"), title: "New edition posted", body: "The Week 2 Edition", target: { kind: "writeup", week: 2 } },
      { id: "video:v2", kind: "video", at: ms("2026-09-23T03:00:00Z"), title: "New chug video", body: "You chugged for Week 2", target: { kind: "videos" } },
      { id: "video:v1", kind: "video", at: ms("2026-09-23T02:00:00Z"), title: "New chug video", body: "Uploader chugged for Week 2", target: { kind: "videos" } },
      { id: "iced:W02#4#1", kind: "iced", at: ms("2026-09-22T08:00:00Z"), title: "You got iced", body: "Week 2: lowest score", target: { kind: "team", rosterId: ME } },
    ]);
  });

  it("names the team when a video has no uploader", () => {
    const [item] = deriveNotifications(sources({ ledger: null, writeups: [], transactions: [], videos: [video({ uploaderName: null })] }));
    expect(item.body).toBe("Team 9 chugged for Week 2");
  });

  it("stamps the nth late ice n-1 wall-clock weeks after the deadline", () => {
    const late = ice({ iceId: "W02#4#1#LATE2", week: 2, reason: "late", parentIceId: "W02#4#1" });
    const only = { ledger: { ...LEDGER, ices: [late] }, writeups: [], videos: [], transactions: [] };
    expect(deriveNotifications(sources({ ...only, now: ms("2026-10-04T16:59:00Z") }))).toEqual([]);
    const [item] = deriveNotifications(sources({ ...only, now: ms("2026-10-05T12:00:00Z") }));
    expect(item.at).toBe(ms("2026-10-04T17:00:00Z"));
  });

  it("is deterministic regardless of input order", () => {
    const s = sources();
    const shuffled = { ...s, videos: [...s.videos].reverse(), transactions: [...s.transactions].reverse() };
    expect(deriveNotifications(shuffled)).toEqual(deriveNotifications(s));
  });
});

describe("due window", () => {
  const due = (now: string) => deriveNotifications(sources({ now: ms(now) })).find((n) => n.kind === "due");

  it("opens at Friday 00:00 ET and closes at the deadline", () => {
    expect(due("2026-10-02T03:59:59Z")).toBeUndefined();
    expect(due("2026-10-02T04:00:00Z")).toEqual({
      id: "due:W03",
      kind: "due",
      at: ms("2026-10-02T04:00:00Z"),
      title: "Ice due Sunday 1 PM ET",
      body: "You owe 1 ice for Week 3",
      target: { kind: "ices" },
    });
    expect(due("2026-10-04T16:59:59Z")?.id).toBe("due:W03");
    expect(due("2026-10-04T17:00:00Z")).toBeUndefined();
  });

  it("keeps Friday midnight in EDT when the deadline Sunday is in EST", () => {
    expect(due("2026-10-30T03:59:59Z")).toBeUndefined();
    expect(due("2026-10-30T04:00:00Z")).toMatchObject({ id: "due:W09", title: "Ice due Sunday 1 PM ET" });
    expect(due("2026-11-01T17:59:59Z")?.id).toBe("due:W09");
    expect(due("2026-11-01T18:00:00Z")).toBeUndefined();
  });

  it("drops out once my originals are paid, and ignores late rows and other rosters", () => {
    const paid = { ...LEDGER, ices: LEDGER.ices.map((i) => (i.iceId === "W03#4#0" ? { ...i, status: "completed" as const } : i)) };
    const now = ms("2026-10-03T12:00:00Z");
    expect(ids(sources({ ledger: paid, now }))).not.toContain("due:W03");
    expect(ids(sources({ myRosterId: 9, now }))).toContain("due:W03");
    expect(ids(sources({ myRosterId: 2, now }))).not.toContain("due:W03");
  });

  it("counts every owed original", () => {
    const two = { ...LEDGER, ices: [...LEDGER.ices, ice({ iceId: "W03#4#1", reason: "empty" })] };
    expect(deriveNotifications(sources({ ledger: two, now: ms("2026-10-03T12:00:00Z") })).find((n) => n.kind === "due")?.body).toBe(
      "You owe 2 ices for Week 3",
    );
  });
});

describe("unreadCount", () => {
  const items = deriveNotifications(sources());

  it("counts everything when nothing has been seen", () => {
    expect(unreadCount(items, null)).toBe(7);
    expect(unreadCount(items, undefined)).toBe(7);
  });

  it("counts only items after the seen mark, whatever its offset", () => {
    expect(unreadCount(items, "2026-09-24T11:00:00-04:00")).toBe(3);
    expect(unreadCount(items, "2026-09-24T15:00:00Z")).toBe(3);
    expect(unreadCount(items, "2026-09-30T00:00:00Z")).toBe(0);
  });
});
