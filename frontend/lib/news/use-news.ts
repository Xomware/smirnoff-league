"use client";

import { useEffect, useState } from "react";

import { getWriteups, type Writeup } from "@/lib/api/writeups";
import { useLedger } from "@/lib/ices/use-ledger";
import { leagueTransactions } from "@/lib/league/cache";
import { useLeague } from "@/lib/league/use-league";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { ledgerItems, type NewsItem, sortFeed, transactionItems, writeupItems } from "./feed";

// Sleeper is required; the ledger and write-ups need the API, so the feed
// goes out without them and `missing` names what was left out.
export function useNews() {
  const { data, error: leagueError, teamFor } = useLeague();
  const ledger = useLedger();
  const [txs, setTxs] = useState<SleeperTransaction[] | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [writeups, setWriteups] = useState<Writeup[] | "error" | null>(null);
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

  useEffect(() => {
    let live = true;
    getWriteups().then(
      (w) => live && setWriteups(w),
      () => live && setWriteups("error"),
    );
    return () => {
      live = false;
    };
  }, []);

  const ready = data && txs && ledger.status !== "loading" && writeups !== null;
  const feed: NewsItem[] | null = ready
    ? sortFeed([
        ...transactionItems(txs),
        ...(ledger.status === "ok" ? ledgerItems(ledger.ledger) : []),
        ...(writeups === "error" ? [] : writeupItems(writeups)),
      ])
    : null;
  const missing = [ledger.status === "error" && "ice events", writeups === "error" && "news drops"].filter((m) => m !== false);

  return { data, teamFor, week, feed, missing, error: leagueError ?? txError };
}
