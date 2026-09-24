import type { DrillTarget } from "@/components/views/drill-link";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import { countdown, currentWeek, urgency } from "@/lib/ices/chug-board";
import type { Standing } from "@/lib/league/standings";
import type { Game } from "@/lib/league/use-week-games";

export interface TickerItem {
  id: string;
  tag: string;
  text: string;
  to: DrillTarget;
  trouble?: boolean;
}

export interface TickerSources {
  week: number | undefined;
  current: number | undefined;
  games: Game[] | null;
  /** True while any NFL game in the week is in progress. */
  live: boolean;
  ledger: Ledger | null;
  videos: Video[];
  writeups: Writeup[];
  standings: Standing[] | null;
  teamName: (rosterId: number) => string;
  now: number;
}

const RECENT = 3;
const CAUSE: Record<Exclude<LedgerIce["reason"], "late">, string> = {
  zero: "zero starter",
  empty: "empty slot",
  lowest: "lowest score",
  admin: "commish ice",
};

const etDue = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });
const record = (s: Standing) => `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`;
const newest = <T>(rows: T[], at: (row: T) => string | undefined) =>
  rows.filter((r) => at(r)).sort((a, b) => Date.parse(at(b)!) - Date.parse(at(a)!)).slice(0, RECENT);

function scores({ week, current, games, live, teamName }: TickerSources): TickerItem[] {
  if (!games || week === undefined) return [];
  const tag = live ? "LIVE" : week === current ? `W${week}` : `W${week} FINAL`;
  return games
    .filter((g) => g.sides.length === 2)
    .map(({ id, sides: [a, b] }) => ({
      id: `score:${week}:${id}`,
      tag,
      text: `${teamName(a.rosterId)} ${a.points.toFixed(1)} – ${b.points.toFixed(1)} ${teamName(b.rosterId)}`,
      to: { kind: "game", week, matchup: id },
    }));
}

function ices({ ledger, teamName }: TickerSources): TickerItem[][] {
  if (!ledger) return [[], []];
  const week = currentWeek(ledger);
  const iced = ledger.ices.flatMap((i): TickerItem[] =>
    i.week === week && i.reason !== "late"
      ? [{ id: `iced:${i.iceId}`, tag: "ICED", text: `${teamName(i.rosterId)} iced · W${week} ${CAUSE[i.reason]}`, to: { kind: "team", rosterId: i.rosterId }, trouble: true }]
      : [],
  );
  const late = ledger.ices.flatMap((i): TickerItem[] =>
    i.reason === "late" && i.status === "owed"
      ? [{ id: `late:${i.iceId}`, tag: "LATE", text: `${teamName(i.rosterId)} late · W${i.week} ice unpaid`, to: { kind: "ices" }, trouble: true }]
      : [],
  );
  return [iced, late];
}

function chugs({ ledger, videos, teamName }: TickerSources): TickerItem[] {
  const posted = newest(videos, (v) => v.createdAt).map(
    (v): TickerItem => ({
      id: `video:${v.mediaId}`,
      tag: "CHUG",
      text: `${v.uploaderName ?? teamName(v.rosterIds[0])} posted a chug · W${v.week}`,
      to: { kind: "videos" },
    }),
  );
  const timed = newest(ledger?.ices.filter((i) => i.chugSeconds !== undefined) ?? [], (i) => i.timedAt ?? i.completedAt ?? undefined).map(
    (i): TickerItem => ({
      id: `time:${i.iceId}`,
      tag: "CHUG",
      text: `${i.chugger?.name ?? teamName(i.rosterId)} chugged in ${i.chugSeconds!.toFixed(1)}s`,
      to: { kind: "chug-rankings" },
    }),
  );
  return [...posted, ...timed];
}

function standings({ standings: rows, teamName }: TickerSources): TickerItem[] {
  if (!rows?.length) return [];
  const [first, last] = [rows[0], rows.at(-1)!];
  return [
    { id: "lead", tag: "STANDINGS", text: `${teamName(first.rosterId)} leads at ${record(first)}`, to: { kind: "standings" } },
    { id: "last", tag: "STANDINGS", text: `${teamName(last.rosterId)} is last at ${record(last)}`, to: { kind: "standings" } },
  ];
}

function news({ writeups }: TickerSources): TickerItem[] {
  const [latest] = newest(writeups, (w) => w.publishedAt);
  return latest ? [{ id: `news:${latest.mediaId}`, tag: "NEWS DROP", text: latest.title, to: { kind: "writeup", week: latest.week } }] : [];
}

function due({ ledger, now }: TickerSources): TickerItem[] {
  const next = Math.min(...(ledger?.weeks ?? []).flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])).filter((d) => d > now));
  if (!Number.isFinite(next)) return [];
  const when = etDue.format(next).replace(":00", "");
  const left = countdown(next, now, 0).replace("due in ", "");
  return [{ id: "due", tag: "DUE", text: `Ices due ${when} ET · ${left}`, to: { kind: "ices" }, trouble: urgency(next, now) === "soon" }];
}

/** Every source's items, dealt round-robin so no one kind runs for long. */
export function tickerItems(s: TickerSources): TickerItem[] {
  const [iced, late] = ices(s);
  const groups = [scores(s), iced, chugs(s), standings(s), late, news(s), due(s)];
  const longest = Math.max(...groups.map((g) => g.length));
  return Array.from({ length: longest }, (_, i) => groups.flatMap((g) => (g[i] ? [g[i]] : []))).flat();
}
