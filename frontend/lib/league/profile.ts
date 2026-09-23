import { benchPoints } from "@/lib/ices/analysis";
import type { PositionOf, StatsWeek } from "@/lib/ices/stats";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { type TeamWeek, teamResults } from "./drill";

export interface ResultRow extends TeamWeek {
  margin: number | null;
  benchLeft: number | null;
  leagueAvg: number;
}

export interface HeadToHead {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
}

export interface Pick {
  season: string;
  round: number;
  original: number;
}

export interface TeamMove {
  id: string;
  week: number;
  type: SleeperTransaction["type"];
  added: string[];
  dropped: string[];
  picksIn: Pick[];
  picksOut: Pick[];
  partners: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function profileResults(weeks: StatsWeek[], rosterId: number, positionOf: PositionOf): ResultRow[] {
  const bench = benchPoints(weeks, positionOf).find((b) => b.rosterId === rosterId)?.weeks ?? [];
  return teamResults(weeks, rosterId).map((r) => {
    const { matchups } = weeks.find((w) => w.week === r.week)!;
    return {
      ...r,
      margin: r.opponent ? round2(r.points - r.opponent.points) : null,
      benchLeft: bench.find((b) => b.week === r.week)?.left ?? null,
      leagueAvg: matchups.reduce((a, m) => a + m.points, 0) / matchups.length,
    };
  });
}

// Every other team gets a row, so an opponent not yet played still drills.
export function headToHead(weeks: StatsWeek[], rosterId: number, rosterIds: number[]): HeadToHead[] {
  const rows = new Map(
    rosterIds.filter((id) => id !== rosterId).map((id) => [id, { rosterId: id, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 }]),
  );
  for (const r of teamResults(weeks, rosterId)) {
    const row = r.opponent && rows.get(r.opponent.rosterId);
    if (!row) continue;
    row.pf = round2(row.pf + r.points);
    row.pa = round2(row.pa + r.opponent!.points);
    if (r.result === "W") row.wins++;
    else if (r.result === "L") row.losses++;
    else row.ties++;
  }
  const games = (h: HeadToHead) => h.wins + h.losses + h.ties;
  return [...rows.values()].sort((a, b) => games(b) - games(a) || a.rosterId - b.rosterId);
}

export function seasonPoints(weeks: StatsWeek[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const w of weeks) {
    for (const m of w.matchups) {
      for (const [id, p] of Object.entries(m.players_points ?? {})) points.set(id, round2((points.get(id) ?? 0) + p));
    }
  }
  return points;
}

// `adds` and `drops` map a player to the roster gaining or losing him.
export function teamTransactions(txs: SleeperTransaction[], rosterId: number): TeamMove[] {
  const mine = (moves: Record<string, number> | null) =>
    Object.entries(moves ?? {})
      .filter(([, id]) => id === rosterId)
      .map(([playerId]) => playerId);
  const pick = ({ season, round, roster_id }: SleeperTransaction["draft_picks"][number]) => ({ season, round, original: roster_id });
  return txs
    .filter((t) => t.status === "complete" && t.roster_ids.includes(rosterId))
    .sort((a, b) => b.leg - a.leg || b.status_updated - a.status_updated)
    .map((t) => ({
      id: t.transaction_id,
      week: t.leg,
      type: t.type,
      added: mine(t.adds),
      dropped: mine(t.drops),
      picksIn: t.draft_picks.filter((p) => p.owner_id === rosterId).map(pick),
      picksOut: t.draft_picks.filter((p) => p.previous_owner_id === rosterId).map(pick),
      partners: t.roster_ids.filter((id) => id !== rosterId),
    }));
}
