import type { DrillTarget } from "@/components/views/drill-link";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { Writeup } from "@/lib/api/writeups";
import { awardLabel, awardStat, type WeekAwards } from "@/lib/awards/awards";
import { countdown, currentWeek, timeLeft, urgency } from "@/lib/ices/chug-board";
import type { Standing } from "@/lib/league/standings";
import type { Player } from "@/lib/league/use-league";
import type { Game, Starter } from "@/lib/league/use-week-games";

export interface TickerItem {
  id: string;
  tag: string;
  text: string;
  to: DrillTarget;
  /** Owed ices are red, late ones a stronger red, paid ones muted. */
  tone?: "due" | "late" | "paid";
}

export interface TickerSources {
  week: number | undefined;
  current: number | undefined;
  games: Game[] | null;
  /** True while any NFL game in the week is in progress. */
  live: boolean;
  ledger: Ledger | null;
  players: Record<string, Player>;
  videos: Video[];
  writeups: Writeup[];
  standings: Standing[] | null;
  /** The latest finalized week's awards. */
  awards: WeekAwards | null;
  teamName: (rosterId: number) => string;
  now: number;
}

const RECENT = 3;
const SEASON_TEAMS = 6;

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

function cause(ice: LedgerIce, players: Record<string, Player>): string {
  const points = ice.points === undefined ? "" : ` ${ice.points.toFixed(2)}`;
  if (ice.reason === "empty") return `empty ${ice.slot} slot`;
  if (ice.reason === "lowest") return `lowest score${points}`;
  if (ice.reason === "admin") return "commish ice";
  const player = players[ice.playerId ?? ""];
  return `${player?.name ?? ice.playerId} (${player?.position ?? ice.slot})${points}`;
}

// Every unpaid ice, plus the newest week's paid ones, each with what caused it.
function ledgerIces({ ledger, players, teamName, now }: TickerSources): TickerItem[] {
  if (!ledger) return [];
  const week = currentWeek(ledger);
  const deadline = new Map(ledger.weeks.map((w) => [w.week, w.deadlineUtc ? Date.parse(w.deadlineUtc) : null]));
  const owedLate = ledger.ices.filter((i) => i.reason === "late" && i.status === "owed");
  const byId = new Map(ledger.ices.map((i) => [i.iceId, i]));
  const rows = ledger.ices
    .filter((i) => i.reason !== "late" && (i.status === "owed" || i.week === week))
    .sort((a, b) => a.week - b.week || a.iceId.localeCompare(b.iceId));

  const originals = rows.map((i): TickerItem => {
    const head = `${teamName(i.rosterId)} ${i.status === "owed" ? "owes an ice" : "iced"} · W${i.week} ${cause(i, players)}`;
    const to: DrillTarget = { kind: "team", rosterId: i.rosterId };
    const id = `ice:${i.iceId}`;
    if (i.status === "completed") {
      return i.chugSeconds === undefined
        ? { id, tag: "PAID", text: head, to, tone: "paid" }
        : { id, tag: "CHUG", text: `${head} · chugged in ${i.chugSeconds.toFixed(1)}s`, to, tone: "paid" };
    }
    const late = owedLate.filter((l) => l.parentIceId === i.iceId).length;
    const due = deadline.get(i.week) ?? null;
    if (late || (due !== null && due <= now)) return { id, tag: "LATE", text: `${head} · ${late ? `+${late} late` : "past due"}`, to, tone: "late" };
    return { id, tag: "DUE", text: due === null ? head : `${head} · due ${timeLeft(due - now)}`, to, tone: "due" };
  });
  const orphans = owedLate.flatMap((l): TickerItem[] => {
    const parent = byId.get(l.parentIceId ?? "");
    if (parent?.status === "owed") return [];
    const what = parent ? ` · W${parent.week} ${cause(parent, players)}` : ` · W${l.week}`;
    return [{ id: `ice:${l.iceId}`, tag: "LATE", text: `${teamName(l.rosterId)} owes a late ice${what}`, to: { kind: "ices" }, tone: "late" }];
  });
  return [...originals, ...orphans];
}

function thisWeek({ week, current, games, players, teamName }: TickerSources): TickerItem[] {
  if (!games || week === undefined || week !== current) return [];
  const label = (s: Starter) => (s.playerId ? `${players[s.playerId]?.name ?? s.playerId} ${players[s.playerId]?.position ?? s.slot}` : `empty ${s.slot}`);
  const iced = games
    .flatMap((g) => g.sides)
    .flatMap((side) => (side.starters ?? []).filter((s) => s.iced).map((s) => `${teamName(side.rosterId)} (${label(s)})`));
  const text = iced.length ? `Week ${week} ices · ${iced.length} so far: ${iced.join(", ")}` : `Week ${week} ices · none so far`;
  return [{ id: "ice:this-week", tag: "THIS WEEK", text, to: { kind: "watch" } }];
}

function season({ ledger, teamName }: TickerSources): TickerItem[] {
  if (!ledger) return [];
  const counts = new Map<number, number>();
  for (const i of ledger.ices) if (i.reason !== "late") counts.set(i.rosterId, (counts.get(i.rosterId) ?? 0) + 1);
  const top = [...counts].sort(([a, x], [b, y]) => y - x || a - b);
  const shown = top.slice(0, SEASON_TEAMS).map(([r, n]) => `${teamName(r)} ${n}`);
  const text = top.length ? [...shown, ...(top.length > SEASON_TEAMS ? ["…"] : [])].join(" · ") : "none yet";
  return [{ id: "ice:season", tag: "SEASON", text: `Season ices · ${text}`, to: { kind: "ice-standings" } }];
}

function chugs({ ledger, videos, teamName }: TickerSources): TickerItem[] {
  const shown = ledger ? currentWeek(ledger) : 0;
  const posted = newest(videos, (v) => v.createdAt).map(
    (v): TickerItem => ({
      id: `video:${v.mediaId}`,
      tag: "CHUG",
      text: `${v.uploaderName ?? teamName(v.rosterIds[0])} posted a chug · W${v.week}`,
      to: { kind: "videos" },
    }),
  );
  const timed = newest(ledger?.ices.filter((i) => i.chugSeconds !== undefined && i.week !== shown) ?? [], (i) => i.timedAt ?? i.completedAt ?? undefined).map(
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
  return [{ id: "ice:due", tag: "DUE", text: `Ices due ${when} ET · ${left}`, to: { kind: "ices" }, tone: urgency(next, now) === "soon" ? "due" : undefined }];
}

function awards({ awards: latest, teamName }: TickerSources): TickerItem[] {
  if (!latest) return [];
  const { week } = latest;
  return latest.awards.map((a) => ({
    id: `award:${week}:${a.id}`,
    tag: "AWARD",
    text: `${awardLabel(a.id)} W${week} · ${a.winners.map((w) => teamName(w.rosterId)).join(", ")} ${awardStat(a)}`,
    to: { kind: "awards", week },
  }));
}

const roundRobin = (groups: TickerItem[][]) =>
  Array.from({ length: Math.max(0, ...groups.map((g) => g.length)) }, (_, i) => groups.flatMap((g) => (g[i] ? [g[i]] : []))).flat();

/**
 * Ice items alternate with everything else, so at least one is always on
 * screen. When there are fewer ice items they repeat to fill the gaps.
 */
export function tickerItems(s: TickerSources): TickerItem[] {
  const ice = [...thisWeek(s), ...season(s), ...due(s), ...ledgerIces(s)];
  const rest = roundRobin([scores(s), chugs(s), standings(s), news(s), awards(s)]);
  if (!ice.length) return rest;
  return Array.from({ length: Math.max(ice.length, rest.length) }, (_, i) => {
    const lap = Math.floor(i / ice.length);
    const item = ice[i % ice.length];
    return [lap ? { ...item, id: `${item.id}~${lap}` } : item, ...(rest[i] ? [rest[i]] : [])];
  }).flat();
}
