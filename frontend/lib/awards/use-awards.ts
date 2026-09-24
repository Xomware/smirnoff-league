"use client";

import { useEffect, useMemo, useState } from "react";

import { useLedger } from "@/lib/ices/use-ledger";
import { leagueMatchups } from "@/lib/league/cache";
import { useLeague } from "@/lib/league/use-league";
import type { SleeperMatchup } from "@/lib/sleeper/types";
import { awardTally, finalWeeks, weekAwards } from "./awards";

// Every finalized week's awards, oldest first. The ledger feeds the ice
// awards; without it the Sleeper awards still go out and `ledgerError` says why.
export function useAwards() {
  const { data, error, teamFor } = useLeague();
  const ledger = useLedger();
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const settled = data !== null && ledger.status !== "loading";
  const key = settled ? finalWeeks(data.nfl.week, ok?.weeks ?? null).join(",") : null;
  const [rows, setRows] = useState<{ key: string; weeks: { week: number; matchups: SleeperMatchup[] }[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    const weeks = key ? key.split(",").map(Number) : [];
    Promise.all(weeks.map((week) => leagueMatchups(week, false).then((matchups) => ({ week, matchups })))).then(
      (loaded) => live && setRows({ key, weeks: loaded }),
      (e: Error) => live && setLoadError(e.message),
    );
    return () => {
      live = false;
    };
  }, [key]);

  const weeks = useMemo(() => {
    if (!data || !rows || rows.key !== key) return null;
    const positionOf = (id: string) => data.players[id]?.position;
    return rows.weeks.map(({ week, matchups }) => weekAwards(week, matchups, ok?.ices ?? null, positionOf));
  }, [data, rows, key, ok]);

  return {
    weeks,
    tally: useMemo(() => (weeks ? awardTally(weeks) : null), [weeks]),
    players: data?.players ?? {},
    teamFor,
    error: error ?? loadError,
    ledgerError: ledger.status === "error" ? ledger.message : null,
  };
}
