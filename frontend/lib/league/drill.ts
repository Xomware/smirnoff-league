import { defaultWeekSettings, type Ice, lockedIces, type MatchupRow, SLOTS, weekIces } from "@/lib/ices/compute";
import type { StatsMatchup } from "@/lib/ices/stats";

export interface WeekMatchups<M extends MatchupRow = StatsMatchup> {
  week: number;
  matchups: M[];
}

export interface TeamWeek {
  week: number;
  points: number;
  opponent: { rosterId: number; points: number } | null;
  result: "W" | "L" | "T" | null;
  ices: Ice[];
}

export interface PlayerWeek {
  week: number;
  rosterId: number;
  points: number;
  started: boolean;
  ice: Ice | null;
}

const byWeek = <W extends { week: number }>(weeks: W[]) => [...weeks].sort((a, b) => a.week - b.week);

const finishedIces = ({ week, matchups }: WeekMatchups<MatchupRow>) =>
  weekIces(week, matchups, SLOTS, defaultWeekSettings(week));

export function teamResults(weeks: WeekMatchups<MatchupRow>[], rosterId: number): TeamWeek[] {
  return byWeek(weeks).flatMap((w) => {
    const mine = w.matchups.find((m) => m.roster_id === rosterId);
    if (!mine) return [];
    const opp =
      mine.matchup_id === null
        ? undefined
        : w.matchups.find((m) => m.matchup_id === mine.matchup_id && m.roster_id !== rosterId);
    const result = !opp ? null : mine.points > opp.points ? "W" : mine.points < opp.points ? "L" : "T";
    return [
      {
        week: w.week,
        points: mine.points,
        opponent: opp ? { rosterId: opp.roster_id, points: opp.points } : null,
        result,
        ices: finishedIces(w).filter((i) => i.rosterId === rosterId),
      },
    ];
  });
}

// A player can change rosters mid-season, so each week looks him up on every roster.
export function playerWeeks(weeks: WeekMatchups[], playerId: string): PlayerWeek[] {
  return byWeek(weeks).flatMap((w) => {
    const ices = finishedIces(w);
    return w.matchups
      .filter((m) => m.players?.includes(playerId) || m.starters?.includes(playerId))
      .map((m) => {
        const slot = m.starters?.indexOf(playerId) ?? -1;
        return {
          week: w.week,
          rosterId: m.roster_id,
          points: m.players_points?.[playerId] ?? m.starters_points[slot] ?? 0,
          started: slot !== -1,
          ice: ices.find((i) => i.playerId === playerId && i.rosterId === m.roster_id) ?? null,
        };
      });
  });
}

export function byRoster<T extends Pick<Ice, "rosterId">>(ices: T[]): [number, T[]][] {
  const groups = new Map<number, T[]>();
  for (const ice of ices) groups.set(ice.rosterId, [...(groups.get(ice.rosterId) ?? []), ice]);
  return [...groups].sort(([a], [b]) => a - b);
}

export function weekSummary<M extends MatchupRow>(week: number, matchups: M[], live: boolean) {
  const ices = live ? lockedIces(week, matchups, SLOTS) : weekIces(week, matchups, SLOTS, defaultWeekSettings(week));

  const pairs = new Map<number, M[]>();
  for (const m of matchups) {
    if (m.matchup_id !== null) pairs.set(m.matchup_id, [...(pairs.get(m.matchup_id) ?? []), m]);
  }

  const low = Math.min(...matchups.map((m) => m.points));
  return {
    pairs: [...pairs].sort(([a], [b]) => a - b).map(([, sides]) => sides),
    icesByRoster: byRoster(ices),
    lowest: matchups.length
      ? { rosterIds: matchups.filter((m) => m.points === low).map((m) => m.roster_id), points: low }
      : null,
  };
}
