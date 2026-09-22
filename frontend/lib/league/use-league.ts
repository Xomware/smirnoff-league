"use client";

import { useCallback, useEffect, useState } from "react";

import { getLeague, getMatchups, getNflState, getRosters, getUsers } from "@/lib/sleeper/client";
import type {
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperRoster,
  SleeperUser,
} from "@/lib/sleeper/types";

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

async function getPlayers(): Promise<Record<string, Player>> {
  const res = await fetch("/data/players.json");
  if (!res.ok) throw new Error(`players.json: ${res.status}`);
  return (await res.json()) as Record<string, Player>;
}

async function loadLeague(): Promise<LeagueData> {
  const [league, users, rosters, nfl, players] = await Promise.all([
    getLeague(),
    getUsers(),
    getRosters(),
    getNflState(),
    getPlayers(),
  ]);
  return { league, users, rosters, nfl, players };
}

// Loads the league once per mount, plus matchups for `week` whenever it is set.
export function useLeague(week?: number) {
  const [data, setData] = useState<LeagueData | null>(null);
  const [matchups, setMatchups] = useState<{ week: number; rows: SleeperMatchup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadLeague()
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (week === undefined) return;
    let live = true;
    getMatchups(week)
      .then((rows) => live && setMatchups({ week, rows }))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [week]);

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
    error,
    teamFor,
  };
}
