"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperRoster,
  SleeperUser,
} from "@/lib/sleeper/types";
import { league, leagueMatchups, players, rosters, users } from "./cache";
import { useNflState } from "./nfl-state";

export interface Player {
  name: string;
  position: string;
  team: string | null;
  injury_status: string | null;
}

export interface LeagueData {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  nfl: SleeperNflState;
  players: Record<string, Player>;
}

export interface Team {
  name: string;
  avatarUrl: string | null;
  record: { wins: number; losses: number; ties: number };
}

const POLL = 60_000;

async function loadLeague(): Promise<Omit<LeagueData, "nfl">> {
  const [l, u, r, p] = await Promise.all([league(), users(), rosters(), players()]);
  return { league: l, users: u, rosters: r, players: p };
}

// Reads the shared league cache, plus matchups for `week` whenever it is set.
// nfl/state is re-read while mounted, so the live week moves with Sleeper.
// The live week polls, and refresh() refetches it now.
export function useLeague(week?: number) {
  const [base, setBase] = useState<Omit<LeagueData, "nfl"> | null>(null);
  const state = useNflState();
  const nfl = state.status === "ok" ? state.nfl : null;
  const data = useMemo(() => (base && nfl ? { ...base, nfl } : null), [base, nfl]);
  const [matchups, setMatchups] = useState<{ week: number; rows: SleeperMatchup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useRef(() => {});

  useEffect(() => {
    let live = true;
    loadLeague()
      .then((d) => live && setBase(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  // Waits for nfl/state to know whether `week` is live. Every caller sets
  // `week` from that same state, so this adds no round trip in practice.
  const liveWeek = nfl?.week;
  useEffect(() => {
    if (week === undefined || liveWeek === undefined) return;
    let mounted = true;
    const live = week >= liveWeek;
    const load = (fresh: boolean) =>
      leagueMatchups(week, live, fresh)
        .then((rows) => mounted && setMatchups({ week, rows }))
        .catch((e: Error) => mounted && setError(e.message));
    load(false);
    reload.current = () => void load(true);
    const timer = live ? setInterval(() => load(false), POLL) : undefined;
    return () => {
      mounted = false;
      clearInterval(timer);
      reload.current = () => {};
    };
  }, [week, liveWeek]);

  const refresh = useCallback(() => reload.current(), []);

  const teamFor = useCallback(
    (rosterId: number): Team => {
      const roster = data?.rosters.find((r) => r.roster_id === rosterId);
      const user = data?.users.find((u) => u.user_id === roster?.owner_id);
      const s = roster?.settings;
      return {
        name: user?.metadata?.team_name || user?.display_name || `Team ${rosterId}`,
        avatarUrl: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
        record: { wins: s?.wins ?? 0, losses: s?.losses ?? 0, ties: s?.ties ?? 0 },
      };
    },
    [data],
  );

  return {
    data,
    // Stale rows from the previous week never render under the new week's label.
    matchups: matchups && matchups.week === week ? matchups.rows : null,
    error: error ?? (state.status === "error" ? state.message : null),
    teamFor,
    refresh,
  };
}
