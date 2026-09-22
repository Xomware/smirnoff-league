"use client";

import { useEffect, useState } from "react";

import type { WeekMatchups } from "@/lib/league/drill";
import { getMatchups } from "@/lib/sleeper/client";
import type { SleeperMatchup } from "@/lib/sleeper/types";
import { type SeasonTally, seasonTally } from "./tally";

// Finished weeks don't change (stat corrections are ignored), so every page
// shares one fetch per finished week. The live week is refetched per mount.
const finished = new Map<number, Promise<SleeperMatchup[]>>();

function matchupsFor(week: number, currentWeek: number): Promise<SleeperMatchup[]> {
  if (week === currentWeek) return getMatchups(week);
  let rows = finished.get(week);
  if (!rows) {
    rows = getMatchups(week);
    finished.set(week, rows);
    // Drop a failed fetch so the next mount retries instead of reusing the rejection.
    rows.catch(() => finished.delete(week));
  }
  return rows;
}

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
    Promise.all(weeks.map((week) => matchupsFor(week, currentWeek).then((matchups) => ({ week, matchups }))))
      .then(
        (rows) =>
          live &&
          setSeason({
            tally: seasonTally(rows, currentWeek),
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
