import { describe, expect, it } from "vitest";

import type { Ledger } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import type { Game } from "@/lib/league/use-week-games";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { type TickerSources, tickerItems } from "./items";

const side = (rosterId: number, points: number) => ({ rosterId, points, ices: 0, iceList: [], starters: null, bench: null, benchLeft: null });
const GAMES: Game[] = [
  { id: 1, sides: [side(1, 101.24), side(2, 88.4)] },
  { id: 2, sides: [side(3, 120), side(4, 99.9)] },
];

const LEDGER: Ledger = {
  ...SCENARIO_LEDGER,
  ices: [
    ...SCENARIO_LEDGER.ices,
    { iceId: "W01#1#LOWEST", week: 1, rosterId: 6, reason: "lowest", status: "completed", chugSeconds: 7.4, chugger: { name: "Commish" }, timedAt: "2026-09-20T12:00:00Z" },
  ],
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
  videos: [VIDEO],
  writeups: WRITEUPS,
  standings: [1, 2, 3, 4].map((rosterId) => ({ rosterId, wins: 5 - rosterId, losses: rosterId - 1, ties: 0, pf: 100, pa: 90 })),
  teamName: (r) => `Team ${r}`,
  // Thursday 2026-09-24 13:00 ET, three days before W2's Sunday deadline.
  now: Date.parse("2026-09-24T17:00:00Z"),
};

const texts = (s: TickerSources) => tickerItems(s).map((i) => `${i.tag} | ${i.text}`);

describe("tickerItems", () => {
  it("mixes every kind of item, interleaved rather than grouped", () => {
    const items = tickerItems(base);
    expect(items.slice(0, 7).map((i) => i.tag)).toEqual(["W2 FINAL", "ICED", "CHUG", "STANDINGS", "LATE", "NEWS DROP", "DUE"]);
    expect(texts(base)).toEqual(
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

  it("names the newest finalized week's ices and the unpaid late ones as trouble", () => {
    const items = tickerItems(base);
    const iced = items.filter((i) => i.tag === "ICED");
    const late = items.filter((i) => i.tag === "LATE");
    expect(iced.map((i) => i.text)).toContain("Team 13 iced · W2 lowest score");
    expect(iced.every((i) => i.text.includes("W2"))).toBe(true);
    expect(late).toHaveLength(3);
    expect([...iced, ...late].every((i) => i.trouble)).toBe(true);
    expect(items.find((i) => i.tag === "CHUG")?.trouble).toBeFalsy();
  });

  it("tags live scores LIVE and points each item at its page", () => {
    const items = tickerItems({ ...base, week: 3, live: true });
    expect(items[0]).toMatchObject({ tag: "LIVE", to: { kind: "game", week: 3, matchup: 1 } });
    expect(items.find((i) => i.tag === "NEWS DROP")?.to).toEqual({ kind: "writeup", week: 2 });
    expect(items.find((i) => i.text.startsWith("Commish"))?.to).toEqual({ kind: "chug-rankings" });
    expect(items.find((i) => i.tag === "DUE")?.to).toEqual({ kind: "ices" });
  });

  it("drops the countdown once the last deadline has passed, and skips missing sources", () => {
    const items = tickerItems({ ...base, now: Date.parse("2026-09-28T12:00:00Z"), games: null, ledger: null, videos: [], writeups: [] });
    expect(items.map((i) => i.tag)).toEqual(["STANDINGS", "STANDINGS"]);
  });
});
