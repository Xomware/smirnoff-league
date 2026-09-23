"use client";

import { useMemo } from "react";

import { lineupWeek } from "@/lib/ices/analysis";
import { defaultWeekSettings, type Ice, lockedIces, SLOTS, weekIces } from "@/lib/ices/compute";
import { withDef } from "@/lib/ices/stats";
import { useIceWatch } from "@/lib/ices/use-ice-watch";
import { type StarterWatch, watchStates } from "@/lib/ices/watch";
import { useLeague } from "@/lib/league/use-league";

export interface Starter {
  slot: string;
  playerId: string | null;
  points: number;
  iced: boolean;
  // Only for the live week, once the scoreboard has loaded.
  watch: StarterWatch | null;
}

export interface Benched {
  playerId: string;
  points: number;
}

export interface Side {
  rosterId: number;
  points: number;
  ices: number;
  // What weekIces counts: in the live week, only the locked empty slots.
  iceList: Ice[];
  // These three are null when Sleeper has no lineup for the team.
  starters: Starter[] | null;
  bench: Benched[] | null;
  benchLeft: number | null;
}

export interface Game {
  id: number;
  sides: Side[];
}

// A week's matchups for the phone's cards and the game view: the Scores
// window's ice counts, and in the live week the Ice Watch's count and
// per-starter state.
export function useWeekGames(week: number | undefined) {
  const { data, matchups, error, teamFor } = useLeague(week);
  const current = data ? Math.max(1, data.nfl.week) : undefined;
  const live = week !== undefined && week === current;
  const watch = useIceWatch(live ? week : undefined);

  const games = useMemo((): Game[] | null => {
    if (!data || !matchups || week === undefined) return null;
    const ices = live ? lockedIces(week, matchups, SLOTS) : weekIces(week, matchups, SLOTS, defaultWeekSettings(week));
    const watched = live && watch.matchups && watch.games ? watchStates(week, watch.matchups, watch.games, data.players) : [];
    const positionOf = withDef((id) => data.players[id]?.position);
    const byId = new Map<number, Side[]>();
    for (const m of matchups) {
      if (m.matchup_id === null) continue;
      const mine = ices.filter((i) => i.rosterId === m.roster_id);
      const team = watched.find((t) => t.rosterId === m.roster_id);
      const starters = m.starters;
      const side: Side = {
        rosterId: m.roster_id,
        points: m.points,
        ices: team ? team.finalIce + team.locked : mine.length,
        iceList: mine,
        bench: starters
          ? (m.players ?? [])
              .filter((id) => !starters.includes(id))
              .map((id) => ({ playerId: id, points: m.players_points?.[id] ?? 0 }))
              .sort((a, b) => b.points - a.points)
          : null,
        benchLeft: starters ? lineupWeek(week, m, positionOf).left : null,
        starters:
          starters?.map((raw, i) => {
            const w = team?.starters[i] ?? null;
            return {
              slot: SLOTS[i],
              playerId: raw && raw !== "0" ? raw : null,
              points: m.starters_points[i] ?? 0,
              iced: w ? w.state === "FINAL_ICE" || w.state === "LOCKED" : mine.some((ice) => ice.slotIndex === i),
              watch: w,
            };
          }) ?? null,
      };
      byId.set(m.matchup_id, [...(byId.get(m.matchup_id) ?? []), side]);
    }
    return [...byId].sort(([a], [b]) => a - b).map(([id, sides]) => ({ id, sides }));
  }, [data, matchups, week, live, watch.matchups, watch.games]);

  return { data, games, current, live, liveGames: watch.games?.filter((g) => g.state === "in").length ?? 0, error, teamFor };
}
