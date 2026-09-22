"use client";

import { useEffect, useState } from "react";

import { type Game, getScoreboard } from "@/lib/espn";
import { getMatchups } from "@/lib/sleeper/client";
import type { SleeperMatchup } from "@/lib/sleeper/types";

export const POLL_MS = 45_000;

interface Snapshot {
  week: number;
  matchups: SleeperMatchup[];
  games: Game[];
}

// Every 45s while a game is in progress. Otherwise sleep until the next
// kickoff, or stop for good once nothing is left to play.
function nextDelay(games: Game[]): number | null {
  if (games.some((g) => g.state === "in")) return POLL_MS;
  const kickoffs = games.filter((g) => g.state === "pre").map((g) => Date.parse(g.kickoff));
  if (kickoffs.length === 0) return null;
  return Math.max(POLL_MS, Math.min(...kickoffs) - Date.now());
}

export function useIceWatch(week: number | undefined) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (week === undefined) return;
    let live = true;
    let loading = false;
    let delay: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      timer = delay === null || document.hidden ? undefined : setTimeout(load, delay);
    };

    const load = () => {
      loading = true;
      Promise.all([getMatchups(week), getScoreboard(week)])
        .then(([matchups, games]) => {
          if (!live) return;
          setSnapshot({ week, matchups, games });
          setError(null);
          delay = nextDelay(games);
        })
        // A failed poll keeps the last delay, so a live game retries on the next tick.
        .catch((e: Error) => live && setError(e.message))
        .finally(() => {
          loading = false;
          if (live) schedule();
        });
    };

    const onVisibility = () => {
      if (document.hidden) return schedule();
      if (delay !== null && !loading) load();
    };

    load();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [week]);

  const current = snapshot?.week === week ? snapshot : null;
  return { matchups: current?.matchups ?? null, games: current?.games ?? null, error };
}
