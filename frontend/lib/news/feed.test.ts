import { describe, expect, it } from "vitest";

import type { LedgerIce, LedgerWeek } from "@/lib/api/ledger";
import type { Writeup } from "@/lib/api/writeups";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { filterFeed, ledgerItems, type NewsItem, type Part, sortFeed, timeAgo, transactionItems, writeupItems } from "./feed";

// Shaped like /league/{id}/transactions/{week} rows: W3's free-agent pickup and
// W1's rolling-waiver claim are real; the trade follows Sleeper's documented shape.
const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({
  transaction_id: "1408466849494040576",
  type: "free_agent",
  status: "complete",
  leg: 3,
  roster_ids: [2],
  adds: { "2505": 2 },
  drops: { "7553": 2 },
  draft_picks: [],
  waiver_budget: [],
  settings: null,
  creator: "u2",
  created: 1790167174269,
  status_updated: 1790167174269,
  ...over,
});

const text = (parts: Part[]) =>
  parts.map((p) => (typeof p === "string" ? p : "rosterId" in p ? `[T${p.rosterId}]` : `[P${p.playerId}]`)).join("");

const headlines = (items: NewsItem[]) => items.map((i) => text(i.headline));

describe("transactionItems", () => {
  it("turns a free-agent add/drop into a move for that roster", () => {
    const [item] = transactionItems([tx({})]);
    expect(item).toMatchObject({
      id: "tx:1408466849494040576",
      event: "move",
      week: 3,
      at: 1790167174269,
      rosterIds: [2],
    });
    expect(text(item.headline)).toBe("[T2] picks up [P2505], drops [P7553]");
  });

  it("says claims for a waiver and shows the FAAB bid when there is one", () => {
    const rolling = tx({ type: "waiver", adds: { "7600": 6 }, drops: { "11655": 6 }, roster_ids: [6], settings: { seq: 0 } });
    const faab = tx({ transaction_id: "2", type: "waiver", adds: { "7600": 6 }, drops: null, roster_ids: [6], settings: { waiver_bid: 12, seq: 1 } });
    expect(headlines(transactionItems([rolling, faab]))).toEqual([
      "[T6] claims [P7600], drops [P11655]",
      "[T6] claims [P7600] ($12 FAAB)",
    ]);
  });

  it("handles drop-only and multi-player moves", () => {
    const dropOnly = tx({ adds: null, drops: { TB: 4 }, roster_ids: [4] });
    const two = tx({ transaction_id: "2", adds: { "1": 5, "2": 5 }, drops: null, roster_ids: [5] });
    expect(headlines(transactionItems([dropOnly, two]))).toEqual(["[T4] drops [PTB]", "[T5] picks up [P1], [P2]"]);
  });

  it("lists what each side of a trade gets: players, picks and FAAB", () => {
    const trade = tx({
      type: "trade",
      roster_ids: [1, 9],
      adds: { "4034": 9, "6794": 1 },
      drops: { "4034": 1, "6794": 9 },
      draft_picks: [{ season: "2027", round: 2, roster_id: 9, previous_owner_id: 9, owner_id: 1 }],
      waiver_budget: [{ sender: 1, receiver: 9, amount: 5 }],
    });
    const [item] = transactionItems([trade]);
    expect(item.event).toBe("trade");
    expect(item.rosterIds).toEqual([1, 9]);
    expect(text(item.headline)).toBe("TRADE: [T1] gets [P6794], 2027 round 2 pick; [T9] gets [P4034], $5 FAAB");
  });

  it("labels a commissioner move", () => {
    const [item] = transactionItems([tx({ type: "commissioner", drops: null, adds: { "9": 3 }, roster_ids: [3] })]);
    expect(item.event).toBe("move");
    expect(text(item.headline)).toBe("Commish move: [T3] picks up [P9]");
  });

  it("drops failed transactions", () => {
    const failed = tx({ status: "failed", type: "waiver", adds: { TB: 2 }, drops: null });
    expect(transactionItems([failed])).toEqual([]);
  });
});

const weeks: LedgerWeek[] = [
  { week: 1, finalizedAt: "2026-09-15T08:00:00+00:00", deadlineUtc: "2026-09-20T17:00:00+00:00" },
  { week: 2, finalizedAt: null, deadlineUtc: null },
];

describe("ledgerItems", () => {
  it("adds each finalized ice at finalize time and each completion at completedAt", () => {
    const ices: LedgerIce[] = [
      { iceId: "W01#R06#S5", week: 1, rosterId: 6, reason: "zero", status: "completed", slot: "TE", playerId: "7553", points: 0, completedAt: "2026-09-19T20:00:00+00:00", chugSeconds: 4.2, videoId: "W01#abc" },
      { iceId: "W01#R08#LOWEST", week: 1, rosterId: 8, reason: "lowest", status: "owed", points: 88.1 },
      { iceId: "W01#R03#S7", week: 1, rosterId: 3, reason: "empty", status: "owed", slot: "FLEX", playerId: null },
    ];
    const items = ledgerItems({ ices, weeks });
    expect(items.map((i) => [i.id, i.event, i.at])).toEqual([
      ["ice:W01#R06#S5", "ice", Date.parse("2026-09-15T08:00:00+00:00")],
      ["paid:W01#R06#S5", "paid", Date.parse("2026-09-19T20:00:00+00:00")],
      ["ice:W01#R08#LOWEST", "ice", Date.parse("2026-09-15T08:00:00+00:00")],
      ["ice:W01#R03#S7", "ice", Date.parse("2026-09-15T08:00:00+00:00")],
    ]);
    expect(headlines(items)).toEqual([
      "[T6] gets iced: [P7553] put up 0.00 at TE",
      "[T6] chugs a Week 1 ice in 4.2s, video posted",
      "[T8] gets iced: lowest score of the week (88.10)",
      "[T3] gets iced: left FLEX empty",
    ]);
    expect(items.every((i) => i.week === 1)).toBe(true);
  });

  it("skips unfinalized weeks and owed late rows, but reports a paid late ice", () => {
    const ices: LedgerIce[] = [
      { iceId: "W02#R13#LOWEST", week: 2, rosterId: 13, reason: "lowest", status: "owed", points: 70 },
      { iceId: "W01#R12#S1#LATE1", week: 1, rosterId: 12, reason: "late", status: "owed", parentIceId: "W01#R12#S1" },
      { iceId: "W01#R12#S2#LATE1", week: 1, rosterId: 12, reason: "late", status: "completed", completedAt: "2026-09-25T01:00:00+00:00" },
    ];
    expect(headlines(ledgerItems({ ices, weeks }))).toEqual(["[T12] chugs a late Week 1 ice"]);
  });
});

describe("writeupItems", () => {
  it("makes a news drop per write-up", () => {
    const w: Writeup = { mediaId: "W03#u1", week: 3, title: "Frozen Solid", publishedAt: "2026-09-23T12:00:00+00:00", pages: [] };
    const [item] = writeupItems([w]);
    expect(item).toMatchObject({ id: "writeup:W03#u1", event: "writeup", week: 3, rosterIds: [] });
    expect(item.at).toBe(Date.parse(w.publishedAt));
    expect(text(item.headline)).toBe("News drop: Frozen Solid");
  });
});

const item = (id: string, event: NewsItem["event"], at: number, rosterIds: number[] = []): NewsItem => ({
  id,
  event,
  at,
  week: 1,
  rosterIds,
  headline: [id],
});

describe("sortFeed and filterFeed", () => {
  const feed = [
    item("a", "move", 100, [2]),
    item("b", "trade", 300, [2, 5]),
    item("c", "ice", 200, [5]),
    item("d", "paid", 200, [2]),
    item("e", "writeup", 400),
  ];

  it("sorts newest first, ties by id", () => {
    expect(sortFeed(feed).map((i) => i.id)).toEqual(["e", "b", "c", "d", "a"]);
  });

  it("filters by type", () => {
    const ids = (f: Parameters<typeof filterFeed>[1]) => filterFeed(feed, f, null).map((i) => i.id);
    expect(ids("all")).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids("moves")).toEqual(["a"]);
    expect(ids("trades")).toEqual(["b"]);
    expect(ids("ices")).toEqual(["c", "d"]);
    expect(ids("writeups")).toEqual(["e"]);
  });

  it("filters by team, alone and with a type", () => {
    expect(filterFeed(feed, "all", 2).map((i) => i.id)).toEqual(["a", "b", "d"]);
    expect(filterFeed(feed, "ices", 5).map((i) => i.id)).toEqual(["c"]);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  it("reads like an inbox", () => {
    expect(timeAgo(now - 20_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(timeAgo(Date.parse("2026-09-01T16:00:00Z"), now)).toBe("Sep 1");
  });
});
