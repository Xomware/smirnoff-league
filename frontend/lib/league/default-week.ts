"use client";

import { useEffect, useState } from "react";

import type { Game } from "@/lib/espn";
import type { SleeperNflState } from "@/lib/sleeper/types";
import { scoreboard } from "./cache";
import { useNflState } from "./nfl-state";

// Sleeper moves to the new week days before it kicks off, so until the first
// game (Thursday night) the week worth looking at is the one that just ended.
export function defaultWeek(nfl: SleeperNflState, games: Game[], now: Date): number {
  const week = Math.max(1, nfl.week);
  if (nfl.season_type === "pre" || week === 1 || games.length === 0) return week;
  if (games.some((g) => g.state !== "pre")) return week;
  const firstKickoff = Math.min(...games.map((g) => Date.parse(g.kickoff)));
  return now.getTime() >= firstKickoff ? week : week - 1;
}

// Re-evaluated on every nfl/state read (every 5 minutes and when the tab comes
// back), so a tab left open across Thursday kickoff moves to the new week.
export function useDefaultWeek(): number | undefined {
  const state = useNflState();
  const [week, setWeek] = useState<number>();

  useEffect(() => {
    if (state.status !== "ok") return;
    const { nfl } = state;
    let live = true;
    scoreboard(Math.max(1, nfl.week))
      .then((games) => defaultWeek(nfl, games, new Date()))
      // Without ESPN there is no kickoff to compare against, so fall back to Sleeper's week.
      .catch(() => Math.max(1, nfl.week))
      .then((w) => live && setWeek(w));
    return () => {
      live = false;
    };
  }, [state]);

  return week;
}
