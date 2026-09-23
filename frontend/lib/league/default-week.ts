"use client";

import { useEffect, useState } from "react";

import type { Game } from "@/lib/espn";
import type { SleeperNflState } from "@/lib/sleeper/types";
import { nflState, scoreboard } from "./cache";

// Sleeper moves to the new week days before it kicks off, so until the first
// game (Thursday night) the week worth looking at is the one that just ended.
export function defaultWeek(nfl: SleeperNflState, games: Game[], now: Date): number {
  const week = Math.max(1, nfl.week);
  if (nfl.season_type === "pre" || week === 1 || games.length === 0) return week;
  if (games.some((g) => g.state !== "pre")) return week;
  const firstKickoff = Math.min(...games.map((g) => Date.parse(g.kickoff)));
  return now.getTime() >= firstKickoff ? week : week - 1;
}

const RECHECK_MS = 5 * 60_000;

// Re-evaluated on a timer and when the tab comes back, so a tab left open
// across Thursday kickoff moves to the new week without a reload.
export function useDefaultWeek(nfl: SleeperNflState | undefined): number | undefined {
  const [week, setWeek] = useState<number>();

  useEffect(() => {
    if (!nfl) return;
    let live = true;
    const evaluate = (state: SleeperNflState, fresh: boolean) =>
      scoreboard(Math.max(1, state.week), fresh)
        .then((games) => defaultWeek(state, games, new Date()))
        // Without ESPN there is no kickoff to compare against, so fall back to Sleeper's week.
        .catch(() => Math.max(1, state.week))
        .then((w) => live && setWeek(w));
    // A failed nfl/state refresh keeps the week on screen; the next check retries.
    const recheck = () => void nflState(true).then((state) => evaluate(state, true), () => undefined);
    const onVisible = () => document.visibilityState === "visible" && recheck();

    void evaluate(nfl, false);
    const timer = setInterval(recheck, RECHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nfl]);

  return week;
}
