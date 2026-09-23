"use client";

import { useEffect, useState } from "react";

import { useLedger } from "@/lib/ices/use-ledger";
import { leagueTransactions } from "@/lib/league/cache";
import { useLeague } from "@/lib/league/use-league";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { useWriteups } from "@/lib/writeups/use-writeups";
import { ledgerItems, type NewsItem, sortFeed, transactionItems, writeupItems } from "./feed";

// Sleeper is required; the ledger and write-ups need the API, so the feed
// goes out without them and `missing` names what was left out.
export function useNews() {
  const { data, error: leagueError, teamFor } = useLeague();
  const ledger = useLedger();
  const [txs, setTxs] = useState<SleeperTransaction[] | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const writeups = useWriteups().state;
  const week = data ? Math.max(1, data.nfl.week) : undefined;

  useEffect(() => {
    if (week === undefined) return;
    let live = true;
    const weeks = Array.from({ length: week }, (_, i) => i + 1);
    Promise.all(weeks.map((w) => leagueTransactions(w, w >= week))).then(
      (all) => live && setTxs(all.flat()),
      (e: Error) => live && setTxError(e.message),
    );
    return () => {
      live = false;
    };
  }, [week]);

  const ready = data && txs && ledger.status !== "loading" && writeups.status !== "loading";
  const feed: NewsItem[] | null = ready
    ? sortFeed([
        ...transactionItems(txs),
        ...(ledger.status === "ok" ? ledgerItems(ledger.ledger) : []),
        ...(writeups.status === "ok" ? writeupItems(writeups.writeups) : []),
      ])
    : null;
  const missing = [ledger.status === "error" && "ice events", writeups.status === "error" && "news drops"].filter((m) => m !== false);

  return { data, teamFor, week, feed, missing, error: leagueError ?? txError };
}
