"use client";

import { useEffect, useState } from "react";

import type { Game } from "@/lib/espn";
import type { SleeperNflState } from "@/lib/sleeper/types";
import { scoreboard } from "./cache";

// Sleeper moves to the new week days before it kicks off, so until the first
// game (Thursday night) the week worth looking at is the one that just ended.
export function defaultWeek(nfl: SleeperNflState, games: Game[], now: Date): number {
  const week = Math.max(1, nfl.week);
  if (nfl.season_type === "pre" || week === 1 || games.length === 0) return week;
  if (games.some((g) => g.state !== "pre")) return week;
  const firstKickoff = Math.min(...games.map((g) => Date.parse(g.kickoff)));
  return now.getTime() >= firstKickoff ? week : week - 1;
}

export function useDefaultWeek(nfl: SleeperNflState | undefined): number | undefined {
  const [week, setWeek] = useState<number>();

  useEffect(() => {
    if (!nfl) return;
    let live = true;
    scoreboard(Math.max(1, nfl.week))
      .then((games) => defaultWeek(nfl, games, new Date()))
      // Without ESPN there is no kickoff to compare against, so fall back to Sleeper's week.
      .catch(() => Math.max(1, nfl.week))
      .then((w) => live && setWeek(w));
    return () => {
      live = false;
    };
  }, [nfl]);

  return week;
}
