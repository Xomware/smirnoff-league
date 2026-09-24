import { describe, expect, it } from "vitest";

import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import type { WeekAwards } from "@/lib/awards/awards";
import type { Game, Side, Starter } from "@/lib/league/use-week-games";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { type TickerItem, type TickerSources, tickerItems } from "./items";

const side = (rosterId: number, points: number, starters: Starter[] | null = null): Side => ({
  rosterId,
  points,
  ices: 0,
  iceList: [],
  starters,
  bench: null,
  benchLeft: null,
});
const GAMES: Game[] = [
  { id: 1, sides: [side(1, 101.24), side(2, 88.4)] },
  { id: 2, sides: [side(3, 120), side(4, 99.9)] },
];

// W1 all paid; W2's three ices unpaid, each with a late ice (roster 13 owes two).
const LEDGER: Ledger = {
  ...SCENARIO_LEDGER,
  ices: [
    ...SCENARIO_LEDGER.ices,
    { iceId: "W01#1#LOWEST", week: 1, rosterId: 6, reason: "lowest", status: "completed", chugSeconds: 7.4, chugger: { name: "Commish" }, timedAt: "2026-09-20T12:00:00Z" },
  ],
};
const PLAYERS = {
  "4983": { name: "DJ Moore", position: "WR", team: "CHI", injury_status: null },
  "9493": { name: "Puka Nacua", position: "WR", team: "LAR", injury_status: null },
  "2505": { name: "Darren Waller", position: "TE", team: "CAR", injury_status: null },
};
const VIDEO: Video = { mediaId: "v1", iceIds: [], week: 2, rosterIds: [12], createdAt: "2026-09-23T12:00:00Z", bytes: 1, url: "" };
const WRITEUPS: Writeup[] = [
  { mediaId: "w1", week: 1, title: "Old news", publishedAt: "2026-09-16T12:00:00Z", pages: [] },
  { mediaId: "w2", week: 2, title: "The Week 2 Drop", publishedAt: "2026-09-23T12:00:00Z", pages: [] },
];

const base: TickerSources = {
  week: 2,
  current: 3,
  games: GAMES,
  live: false,
  ledger: LEDGER,
  players: PLAYERS,
  videos: [VIDEO],
  writeups: WRITEUPS,
  standings: [1, 2, 3, 4].map((rosterId) => ({ rosterId, wins: 5 - rosterId, losses: rosterId - 1, ties: 0, pf: 100, pa: 90 })),
  awards: null,
  teamName: (r) => `Team ${r}`,
  // Thursday 2026-09-24 13:00 ET, three days before W2's Sunday deadline.
  now: Date.parse("2026-09-24T17:00:00Z"),
};

const texts = (items: TickerItem[]) => items.map((i) => `${i.tag} | ${i.text}`);
const isIce = (i: TickerItem) => i.id.startsWith("ice:");

// W2 ices with nothing late yet, plus a paid empty slot and a paid timed chug.
const onTime = (extra: LedgerIce[] = []): Ledger => ({
  ...LEDGER,
  ices: [
    ...LEDGER.ices.filter((i) => i.reason !== "late"),
    { iceId: "W02#R04#S1", week: 2, rosterId: 4, reason: "empty", status: "completed", slotIndex: 1, slot: "RB", playerId: null, points: 0 },
    { iceId: "W02#R05#S5", week: 2, rosterId: 5, reason: "zero", status: "completed", slotIndex: 5, slot: "TE", playerId: "2505", points: 0, chugSeconds: 6.25 },
    ...extra,
  ],
});

describe("tickerItems", () => {
  it("keeps every kind of item in the loop", () => {
    expect(texts(tickerItems(base))).toEqual(
      expect.arrayContaining([
        "W2 FINAL | Team 1 101.2 – 88.4 Team 2",
        "W2 FINAL | Team 3 120.0 – 99.9 Team 4",
        "CHUG | Team 12 posted a chug · W2",
        "CHUG | Commish chugged in 7.4s",
        "STANDINGS | Team 1 leads at 4-0",
        "STANDINGS | Team 4 is last at 1-3",
        "NEWS DROP | The Week 2 Drop",
        "DUE | Ices due Sun 1 PM ET · 3d 0h",
      ]),
    );
  });

  it("names what caused each ice: the zeroed player with position and score, the empty slot, or the lowest score", () => {
    const all = texts(tickerItems({ ...base, ledger: onTime() }));
    expect(all).toEqual(
      expect.arrayContaining([
        "DUE | Team 13 owes an ice · W2 DJ Moore (WR) -0.10 · due 3d 0h",
        "DUE | Team 12 owes an ice · W2 Puka Nacua (WR) 0.00 · due 3d 0h",
        "DUE | Team 13 owes an ice · W2 lowest score 82.10 · due 3d 0h",
        "PAID | Team 4 iced · W2 empty RB slot",
        "CHUG | Team 5 iced · W2 Darren Waller (TE) 0.00 · chugged in 6.3s",
      ]),
    );
  });

  it("tags owed ices DUE in red, late ones LATE, and paid ones neutral, each linked to the team", () => {
    const items = tickerItems(base).filter(isIce);
    const late = items.filter((i) => i.tag === "LATE");
    expect(texts(late)).toEqual([
      "LATE | Team 12 owes an ice · W2 Puka Nacua (WR) 0.00 · +1 late",
      "LATE | Team 13 owes an ice · W2 lowest score 82.10 · +1 late",
      "LATE | Team 13 owes an ice · W2 DJ Moore (WR) -0.10 · +1 late",
    ]);
    expect(late.every((i) => i.tone === "late" && i.to.kind === "team")).toBe(true);

    const due = tickerItems({ ...base, ledger: onTime() }).filter((i) => i.id.startsWith("ice:W02"));
    expect(due.filter((i) => i.tag === "DUE").every((i) => i.tone === "due")).toBe(true);
    expect(due.filter((i) => i.tag === "PAID" || i.tag === "CHUG").map((i) => i.tone)).toEqual(["paid", "paid"]);
    expect(due.find((i) => i.text.startsWith("Team 4"))?.to).toEqual({ kind: "team", rosterId: 4 });

    const passed = tickerItems({ ...base, ledger: onTime(), now: Date.parse("2026-09-28T12:00:00Z") }).filter((i) => i.id.startsWith("ice:W02"));
    expect(texts(passed.filter((i) => i.tone === "late"))).toContain("LATE | Team 13 owes an ice · W2 lowest score 82.10 · past due");
  });

  it("names a late ice still owed after its original was paid", () => {
    const ledger = onTime([{ iceId: "W01#R02#S5#LATE1", week: 1, rosterId: 2, reason: "late", status: "owed", parentIceId: "W01#R02#S5" }]);
    expect(texts(tickerItems({ ...base, ledger }))).toContain("LATE | Team 2 owes a late ice · W1 7553 (TE) 0.00");
  });

  it("counts this week's ices so far during the live week, naming each cause", () => {
    const starter = (slot: string, playerId: string | null, iced: boolean): Starter => ({ slot, playerId, points: 0, iced, watch: null });
    const games: Game[] = [
      { id: 1, sides: [side(1, 40, [starter("QB", "9493", false), starter("TE", null, true)]), side(2, 50, [starter("WR", "4983", true)])] },
    ];
    const live = tickerItems({ ...base, week: 3, games, live: true });
    expect(texts(live.filter((i) => i.tag === "THIS WEEK"))).toEqual(["THIS WEEK | Week 3 ices · 2 so far: Team 1 (empty TE), Team 2 (DJ Moore WR)"]);

    const quiet = tickerItems({ ...base, week: 3, games: [{ id: 1, sides: [side(1, 0, []), side(2, 0, [])] }] });
    expect(texts(quiet.filter((i) => i.tag === "THIS WEEK"))).toEqual(["THIS WEEK | Week 3 ices · none so far"]);
    expect(tickerItems(base).some((i) => i.tag === "THIS WEEK")).toBe(false);
  });

  it("totals the season's ices per team, most first, linked to Ice standings", () => {
    const season = tickerItems(base).find((i) => i.tag === "SEASON");
    expect(season).toMatchObject({ text: "Season ices · Team 6 3 · Team 12 2 · Team 13 2 · Team 2 1 · Team 8 1", to: { kind: "ice-standings" } });
    expect(tickerItems({ ...base, ledger: { ...LEDGER, ices: [] } }).find((i) => i.tag === "SEASON")?.text).toBe("Season ices · none yet");
  });

  it("alternates ice items with the rest, repeating the ice items when there are fewer of them", () => {
    const items = tickerItems(base);
    const ice = items.filter(isIce).length;
    expect(isIce(items[0])).toBe(true);
    expect(items.every((item, i) => isIce(item) || isIce(items[(i + 1) % items.length]))).toBe(true);
    expect(ice / items.length).toBeGreaterThanOrEqual(0.5);
    expect(ice / items.length).toBeLessThan(0.6);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it("tags live scores LIVE and points each item at its page", () => {
    const items = tickerItems({ ...base, week: 3, live: true });
    expect(items.find((i) => i.tag === "LIVE")?.to).toEqual({ kind: "game", week: 3, matchup: 1 });
    expect(items.find((i) => i.tag === "NEWS DROP")?.to).toEqual({ kind: "writeup", week: 2 });
    expect(items.find((i) => i.text.startsWith("Commish"))?.to).toEqual({ kind: "chug-rankings" });
    expect(items.find((i) => i.id === "ice:due")?.to).toEqual({ kind: "ices" });
  });

  it("heads each of the latest final week's awards with its winners, linked to that week's awards", () => {
    const awards: WeekAwards = {
      week: 2,
      awards: [
        { id: "top-score", value: 182.68, winners: [{ rosterId: 1 }] },
        { id: "ice-king", value: 2, winners: [{ rosterId: 6 }, { rosterId: 13 }] },
      ],
    };
    const items = tickerItems({ ...base, awards }).filter((i) => i.tag === "AWARD");
    expect(items.map((i) => i.text)).toEqual(["Top Score W2 · Team 1 182.68 pts", "Ice King W2 · Team 6, Team 13 2 ices"]);
    expect(items.every((i) => i.to.kind === "awards" && i.to.week === 2 && !i.tone)).toBe(true);
  });

  it("drops the countdown once the last deadline has passed, and skips missing sources", () => {
    const items = tickerItems({ ...base, now: Date.parse("2026-09-28T12:00:00Z"), games: null, ledger: null, videos: [], writeups: [] });
    expect(items.map((i) => i.tag)).toEqual(["STANDINGS", "STANDINGS"]);
  });
});
