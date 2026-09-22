// Ice Stats, per "Ice Stats" in docs/features/xp-desktop/PLAN.md. Every input
// week must be finished: a live week's zeros may be players yet to kick off.
import type { SleeperMatchup } from "@/lib/sleeper/types";
import { defaultWeekSettings, type Ice, type MatchupRow, SLOTS, weekIces } from "./compute";

export type StatsMatchup = MatchupRow & Pick<SleeperMatchup, "players" | "players_points">;
export type PositionOf = (playerId: string) => string | undefined;

interface StatsWeek {
  week: number;
  matchups: StatsMatchup[];
}

export interface TeamCount {
  rosterId: number;
  count: number;
}

export interface RepeatOffender {
  playerId: string;
  count: number;
  weeks: number[];
  rosterIds: number[];
}

export interface AvoidableIce {
  ice: Ice;
  playerId: string;
  points: number;
}

export interface Escape {
  week: number;
  rosterId: number;
  slotIndex: number;
  slot: string;
  playerId: string;
  points: number;
}

export interface IceStreak {
  rosterId: number;
  longest: number;
  current: number;
}

const FLEX = new Set(["RB", "WR", "TE"]);

const icesOf = (weeks: StatsWeek[]) =>
  weeks.flatMap(({ week, matchups }) => weekIces(week, matchups, SLOTS, defaultWeekSettings(week)));

// DEF ids are team abbreviations ("HOU"), everyone else is numeric.
const withDef = (positionOf: PositionOf) => (id: string) =>
  positionOf(id) ?? (/^[A-Z]+$/.test(id) ? "DEF" : undefined);

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

function countByTeam(ices: Ice[]): TeamCount[] {
  const counts = new Map<number, number>();
  for (const ice of ices) counts.set(ice.rosterId, (counts.get(ice.rosterId) ?? 0) + 1);
  return [...counts]
    .map(([rosterId, count]) => ({ rosterId, count }))
    .sort((a, b) => b.count - a.count || a.rosterId - b.rosterId);
}

export function repeatOffenders(weeks: StatsWeek[]): RepeatOffender[] {
  const byPlayer = new Map<string, Ice[]>();
  for (const ice of icesOf(weeks)) {
    if (ice.reason !== "zero" || !ice.playerId) continue;
    byPlayer.set(ice.playerId, [...(byPlayer.get(ice.playerId) ?? []), ice]);
  }
  return [...byPlayer]
    .filter(([, ices]) => ices.length >= 2)
    .map(([playerId, ices]) => ({
      playerId,
      count: ices.length,
      weeks: uniqSorted(ices.map((i) => i.week)),
      rosterIds: uniqSorted(ices.map((i) => i.rosterId)),
    }))
    .sort((a, b) => b.count - a.count || (a.playerId < b.playerId ? -1 : 1));
}

export function avoidableIces(weeks: StatsWeek[], positionOf: PositionOf): AvoidableIce[] {
  const posOf = withDef(positionOf);
  const eligible = (slot: string, pos: string | undefined) => pos === slot || (slot === "FLEX" && FLEX.has(pos ?? ""));

  const found: AvoidableIce[] = [];
  for (const { week, matchups } of weeks) {
    const zeros = weekIces(week, matchups, SLOTS, defaultWeekSettings(week)).filter((i) => i.reason === "zero");
    for (const ice of zeros) {
      const m = matchups.find((r) => r.roster_id === ice.rosterId)!;
      const points = m.players_points ?? {};
      const best = (m.players ?? [])
        .filter((id) => !m.starters.includes(id) && (points[id] ?? 0) > 0 && eligible(ice.slot!, posOf(id)))
        .sort((a, b) => points[b] - points[a])[0];
      if (best) found.push({ ice, playerId: best, points: points[best] });
    }
  }
  return found.sort((a, b) => b.points - a.points || (a.ice.id < b.ice.id ? -1 : 1));
}

export function closestEscapes(weeks: StatsWeek[]): Escape[] {
  const escapes: Escape[] = [];
  for (const { week, matchups } of weeks) {
    for (const m of matchups) {
      SLOTS.forEach((slot, i) => {
        const points = m.starters_points[i];
        if (points > 0 && points <= 1) escapes.push({ week, rosterId: m.roster_id, slotIndex: i, slot, playerId: m.starters[i], points });
      });
    }
  }
  return escapes.sort((a, b) => a.points - b.points || a.week - b.week || a.rosterId - b.rosterId);
}

export function iceStreaks(weeks: StatsWeek[]): IceStreak[] {
  const sorted = [...weeks].sort((a, b) => a.week - b.week);
  const streaks = new Map<number, IceStreak>();
  for (const m of sorted.flatMap((w) => w.matchups)) {
    if (!streaks.has(m.roster_id)) streaks.set(m.roster_id, { rosterId: m.roster_id, longest: 0, current: 0 });
  }
  for (const w of sorted) {
    const iced = new Set(icesOf([w]).map((i) => i.rosterId));
    for (const s of streaks.values()) {
      s.current = iced.has(s.rosterId) ? s.current + 1 : 0;
      s.longest = Math.max(s.longest, s.current);
    }
  }
  return [...streaks.values()].sort((a, b) => b.longest - a.longest || b.current - a.current || a.rosterId - b.rosterId);
}

export function iceStats(weeks: StatsWeek[], positionOf: PositionOf) {
  const ices = icesOf(weeks);
  const posOf = withDef(positionOf);

  const byPosition: Record<string, number> = {};
  for (const ice of ices) {
    if (!ice.slot) continue;
    const pos = (ice.playerId && posOf(ice.playerId)) || ice.slot;
    byPosition[pos] = (byPosition[pos] ?? 0) + 1;
  }

  const byReason: Record<Ice["reason"], number> = { zero: 0, empty: 0, lowest: 0 };
  for (const ice of ices) byReason[ice.reason] += 1;

  return {
    repeatOffenders: repeatOffenders(weeks),
    avoidable: avoidableIces(weeks, positionOf),
    closestEscapes: closestEscapes(weeks),
    byWeek: [...weeks]
      .sort((a, b) => a.week - b.week)
      .map(({ week }) => ({ week, count: ices.filter((i) => i.week === week).length })),
    byTeam: countByTeam(ices),
    byReason,
    byPosition,
    lazyManager: countByTeam(ices.filter((i) => i.reason === "empty")),
    streaks: iceStreaks(weeks),
    lowestMagnets: countByTeam(ices.filter((i) => i.reason === "lowest")),
  };
}
