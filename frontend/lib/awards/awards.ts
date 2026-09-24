import type { LedgerIce, LedgerWeek } from "@/lib/api/ledger";
import { lineupWeek } from "@/lib/ices/analysis";
import { chugsFrom } from "@/lib/ices/chug-rankings";
import { type PositionOf, type StatsMatchup, withDef } from "@/lib/ices/stats";

export const AWARDS = [
  { id: "top-score", label: "Top Score" },
  { id: "blowout", label: "Biggest Blowout" },
  { id: "escape", label: "Closest Escape" },
  { id: "choke", label: "Biggest Choke" },
  { id: "bench-hero", label: "Bench Hero" },
  { id: "fastest-chug", label: "Fastest Chug" },
  { id: "ice-king", label: "Ice King" },
] as const;

export type AwardId = (typeof AWARDS)[number]["id"];

export interface Winner {
  rosterId: number;
  opponent?: number;
  playerId?: string;
  chugger?: string | null;
}

export interface Award {
  id: AwardId;
  value: number;
  winners: Winner[];
}

// Only the awards someone won, in AWARDS order.
export interface WeekAwards {
  week: number;
  awards: Award[];
}

export const awardLabel = (id: AwardId) => AWARDS.find((a) => a.id === id)!.label;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Scored<T> {
  value: number;
  winner: T;
}

// Every row on the best value, so a tie shares the award.
function best<T extends Winner>(id: AwardId, rows: Scored<T>[], lowest = false): Award | null {
  if (rows.length === 0) return null;
  const values = rows.map((r) => r.value);
  const value = lowest ? Math.min(...values) : Math.max(...values);
  return { id, value, winners: rows.filter((r) => r.value === value).map((r) => r.winner) };
}

interface Game {
  winner: StatsMatchup;
  loser: StatsMatchup;
  margin: number;
}

// A tied game has no winner, so it takes no margin award.
function games(matchups: StatsMatchup[]): Game[] {
  const byId = new Map<number, StatsMatchup[]>();
  for (const m of matchups) if (m.matchup_id !== null) byId.set(m.matchup_id, [...(byId.get(m.matchup_id) ?? []), m]);
  return [...byId.values()].flatMap((pair) => {
    if (pair.length !== 2) return [];
    const [winner, loser] = [...pair].sort((a, b) => b.points - a.points);
    const margin = round2(winner.points - loser.points);
    return margin > 0 ? [{ winner, loser, margin }] : [];
  });
}

function sleeperAwards(week: number, matchups: StatsMatchup[], positionOf: PositionOf): (Award | null)[] {
  const playing = matchups.filter((m) => m.matchup_id !== null);
  // A week nobody has scored in hasn't been played.
  if (!playing.some((m) => m.points > 0)) return [];
  const played = games(playing);
  const byMargin = played.map((g) => ({ value: g.margin, winner: { rosterId: g.winner.roster_id, opponent: g.loser.roster_id } }));
  const posOf = withDef(positionOf);
  const chokes = played.flatMap((g) => {
    if (g.loser.starters === null) return [];
    const { left } = lineupWeek(week, g.loser, posOf);
    return left > 0 ? [{ value: left, winner: { rosterId: g.loser.roster_id, opponent: g.winner.roster_id } }] : [];
  });
  const bench = playing.flatMap((m) => {
    const starters = m.starters;
    if (starters === null) return [];
    return (m.players ?? [])
      .filter((id) => !starters.includes(id) && (m.players_points?.[id] ?? 0) > 0)
      .map((id) => ({ value: round2(m.players_points![id]), winner: { rosterId: m.roster_id, playerId: id } }));
  });
  return [
    best("top-score", playing.map((m) => ({ value: round2(m.points), winner: { rosterId: m.roster_id } }))),
    best("blowout", byMargin),
    best("escape", byMargin, true),
    best("choke", chokes),
    best("bench-hero", bench),
  ];
}

// Late rows are penalties added after the week, so the week's own ices are the rest.
function ledgerAwards(week: number, ices: LedgerIce[]): (Award | null)[] {
  const chugs = chugsFrom(ices)
    .filter((c) => c.week === week)
    .map((c) => ({ value: c.seconds, winner: { rosterId: c.rosterId, chugger: c.name } }));
  const counts = new Map<number, number>();
  for (const i of ices) if (i.week === week && i.reason !== "late") counts.set(i.rosterId, (counts.get(i.rosterId) ?? 0) + 1);
  const kings = [...counts].sort(([a], [b]) => a - b).map(([rosterId, value]) => ({ value, winner: { rosterId } }));
  return [best("fastest-chug", chugs, true), best("ice-king", kings)];
}

// Either source may be missing; the awards it feeds are left out.
export function weekAwards(week: number, matchups: StatsMatchup[] | null, ices: LedgerIce[] | null, positionOf: PositionOf): WeekAwards {
  const awards = [...(matchups ? sleeperAwards(week, matchups, positionOf) : []), ...(ices ? ledgerAwards(week, ices) : [])];
  return { week, awards: awards.filter((a) => a !== null) };
}

// The ledger finalizes a week once its ices are snapshotted. Without it, a
// week Sleeper has moved past is over.
export function finalWeeks(nflWeek: number, ledgerWeeks: LedgerWeek[] | null): number[] {
  if (ledgerWeeks) return ledgerWeeks.filter((w) => w.finalizedAt).map((w) => w.week).sort((a, b) => a - b);
  return Array.from({ length: Math.max(0, nflWeek - 1) }, (_, i) => i + 1);
}

export interface Tally {
  byAward: { id: AwardId; count: number; leaders: number[] }[];
  teams: { rosterId: number; count: number }[];
}

export function awardTally(weeks: WeekAwards[]): Tally {
  const won = weeks.flatMap((w) => w.awards.flatMap((a) => a.winners.map((x) => ({ id: a.id, rosterId: x.rosterId }))));
  const counts = (rows: { rosterId: number }[]) => {
    const n = new Map<number, number>();
    for (const r of rows) n.set(r.rosterId, (n.get(r.rosterId) ?? 0) + 1);
    return [...n].map(([rosterId, count]) => ({ rosterId, count })).sort((a, b) => b.count - a.count || a.rosterId - b.rosterId);
  };
  const byAward = AWARDS.map(({ id }) => {
    const teams = counts(won.filter((w) => w.id === id));
    const count = teams[0]?.count ?? 0;
    return { id, count, leaders: teams.filter((t) => t.count === count).map((t) => t.rosterId) };
  });
  return { byAward, teams: counts(won) };
}

export interface Names {
  team: (rosterId: number) => string;
  player: (playerId: string) => string;
}

export function awardLine({ id, value }: Award, w: Winner, names: Names): string {
  const pts = value.toFixed(2);
  switch (id) {
    case "top-score":
      return `Put up ${pts}, the most in the league`;
    case "blowout":
      return `Beat ${names.team(w.opponent!)} by ${pts}`;
    case "escape":
      return `Held off ${names.team(w.opponent!)} by ${pts}`;
    case "choke":
      return `Lost to ${names.team(w.opponent!)} with ${pts} left on the bench`;
    case "bench-hero":
      return `${names.player(w.playerId!)} scored ${pts} on the bench`;
    case "fastest-chug":
      return w.chugger ? `${w.chugger} downed it in ${value.toFixed(1)}s` : `Downed in ${value.toFixed(1)}s`;
    case "ice-king":
      return `${value} ${value === 1 ? "ice" : "ices"}, the most in the league`;
  }
}

export function awardStat({ id, value }: Award): string {
  if (id === "fastest-chug") return `${value.toFixed(1)}s`;
  if (id === "ice-king") return `${value} ${value === 1 ? "ice" : "ices"}`;
  return `${value.toFixed(2)} pts`;
}
