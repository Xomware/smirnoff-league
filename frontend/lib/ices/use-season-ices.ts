"use client";

import { useEffect, useState } from "react";

import type { WeekMatchups } from "@/lib/league/drill";
import { leagueMatchups, scoreboard } from "@/lib/league/cache";
import type { SleeperMatchup } from "@/lib/sleeper/types";
import { type SeasonTally, seasonTally } from "./tally";

interface Season {
  tally: SeasonTally;
  finishedWeeks: WeekMatchups<SleeperMatchup>[];
  liveMatchups: SleeperMatchup[];
}

export function useSeasonIces(currentWeek: number | undefined) {
  const [season, setSeason] = useState<Season | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentWeek === undefined) return;
    let live = true;
    const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
    Promise.all([
      Promise.all(weeks.map((week) => leagueMatchups(week, week === currentWeek).then((matchups) => ({ week, matchups })))),
      // ESPN down only means no empty slot locks yet; the rest of the tally still stands.
      scoreboard(currentWeek).catch(() => null),
    ])
      .then(
        ([rows, games]) =>
          live &&
          setSeason({
            tally: seasonTally(rows, currentWeek, games),
            finishedWeeks: rows.filter((w) => w.week < currentWeek),
            liveMatchups: rows.find((w) => w.week === currentWeek)?.matchups ?? [],
          }),
      )
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [currentWeek]);

  return {
    tally: season?.tally ?? null,
    finishedWeeks: season?.finishedWeeks ?? null,
    liveMatchups: season?.liveMatchups ?? null,
    error,
  };
}
