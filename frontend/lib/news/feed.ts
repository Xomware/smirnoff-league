import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Writeup } from "@/lib/api/writeups";
import type { SleeperTransaction } from "@/lib/sleeper/types";

// Teams and players stay ids so the view can render them as drill links.
export type Part = string | { rosterId: number } | { playerId: string };

export interface NewsItem {
  id: string;
  event: "move" | "trade" | "ice" | "paid" | "writeup";
  at: number;
  week: number;
  rosterIds: number[];
  headline: Part[];
  mediaId?: string;
}

export const FILTERS = {
  all: { label: "All", events: ["move", "trade", "ice", "paid", "writeup"] },
  moves: { label: "Transactions", events: ["move"] },
  trades: { label: "Trades", events: ["trade"] },
  ices: { label: "Ices", events: ["ice", "paid"] },
  writeups: { label: "News drops", events: ["writeup"] },
} satisfies Record<string, { label: string; events: NewsItem["event"][] }>;

export type NewsFilter = keyof typeof FILTERS;

const list = (items: Part[][]): Part[] => items.flatMap((p, i) => (i ? [", ", ...p] : p));

const playersFor = (map: Record<string, number> | null, rosterId: number): Part[][] =>
  Object.entries(map ?? {})
    .filter(([, r]) => r === rosterId)
    .map(([playerId]) => [{ playerId }]);

function move(t: SleeperTransaction, rosterId: number): Part[] {
  const adds = playersFor(t.adds, rosterId);
  const drops = playersFor(t.drops, rosterId);
  const verb = t.type === "waiver" ? " claims " : " picks up ";
  const parts: Part[] = [{ rosterId }];
  if (adds.length) parts.push(verb, ...list(adds));
  if (drops.length) parts.push(adds.length ? ", drops " : " drops ", ...list(drops));
  const bid = t.settings?.waiver_bid;
  if (bid !== undefined) parts.push(` ($${bid} FAAB)`);
  return parts;
}

function tradeSide(t: SleeperTransaction, rosterId: number): Part[] {
  const picks = t.draft_picks.filter((p) => p.owner_id === rosterId).map((p) => [`${p.season} round ${p.round} pick`]);
  const faab = t.waiver_budget.filter((b) => b.receiver === rosterId).map((b) => [`$${b.amount} FAAB`]);
  const assets = [...playersFor(t.adds, rosterId), ...picks, ...faab];
  return [{ rosterId }, assets.length ? " gets " : " gets nothing", ...list(assets)];
}

export function transactionItems(txs: SleeperTransaction[]): NewsItem[] {
  return txs
    .filter((t) => t.status === "complete")
    .map((t) => {
      const trade = t.type === "trade";
      const sides = t.roster_ids.map((r) => (trade ? tradeSide(t, r) : move(t, r)));
      const body = sides.flatMap((s, i) => (i ? ["; ", ...s] : s));
      const prefix = trade ? "TRADE: " : t.type === "commissioner" ? "Commish move: " : "";
      return {
        id: `tx:${t.transaction_id}`,
        event: trade ? "trade" : "move",
        at: t.status_updated,
        week: t.leg,
        rosterIds: t.roster_ids,
        headline: prefix ? [prefix, ...body] : body,
      };
    });
}

function iceCause(ice: LedgerIce): Part[] {
  if (ice.reason === "zero") return [{ playerId: ice.playerId! }, ` put up ${(ice.points ?? 0).toFixed(2)} at ${ice.slot}`];
  if (ice.reason === "empty") return [`left ${ice.slot} empty`];
  if (ice.reason === "lowest") return [`lowest score of the week (${(ice.points ?? 0).toFixed(2)})`];
  return [ice.note ? `commish call, ${ice.note}` : "commish call"];
}

// Late rows are made by the deadline cron and carry no creation time, so only
// their completions are news.
export function ledgerItems({ ices, weeks }: Pick<Ledger, "ices" | "weeks">): NewsItem[] {
  const finalized = new Map(weeks.filter((w) => w.finalizedAt).map((w) => [w.week, Date.parse(w.finalizedAt!)]));
  return ices.flatMap((ice) => {
    const base = { week: ice.week, rosterIds: [ice.rosterId] };
    const items: NewsItem[] = [];
    const at = finalized.get(ice.week);
    if (ice.reason !== "late" && at !== undefined) {
      items.push({ ...base, id: `ice:${ice.iceId}`, event: "ice", at, headline: [{ rosterId: ice.rosterId }, " gets iced: ", ...iceCause(ice)] });
    }
    if (ice.status === "completed" && ice.completedAt) {
      const what = ice.reason === "late" ? `a late Week ${ice.week} ice` : `a Week ${ice.week} ice`;
      const chug = ice.chugSeconds !== undefined ? ` in ${ice.chugSeconds}s` : "";
      const video = ice.videoId ? ", video posted" : "";
      items.push({
        ...base,
        id: `paid:${ice.iceId}`,
        event: "paid",
        at: Date.parse(ice.completedAt),
        headline: [{ rosterId: ice.rosterId }, ` chugs ${what}${chug}${video}`],
      });
    }
    return items;
  });
}

export function writeupItems(writeups: Writeup[]): NewsItem[] {
  return writeups.map((w) => ({
    id: `writeup:${w.mediaId}`,
    event: "writeup",
    at: Date.parse(w.publishedAt),
    week: w.week,
    rosterIds: [],
    headline: [`News drop: ${w.title}`],
    mediaId: w.mediaId,
  }));
}

export const sortFeed = (items: NewsItem[]) => [...items].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));

export function filterFeed(items: NewsItem[], filter: NewsFilter, rosterId: number | null): NewsItem[] {
  const events: NewsItem["event"][] = FILTERS[filter].events;
  return items.filter((i) => events.includes(i.event) && (rosterId === null || i.rosterIds.includes(rosterId)));
}

export function timeAgo(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}
