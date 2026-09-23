"use client";

import { useEffect, useState } from "react";

import { getLedger, type Ledger } from "@/lib/api/ledger";

export type LedgerState = { status: "loading" } | { status: "ok"; ledger: Ledger } | { status: "error"; message: string };

const listeners = new Set<() => void>();

// Admin edits call this so every open ledger view refetches, not only the
// Control Panel that made the edit.
export function refreshLedger() {
  for (const refetch of listeners) refetch();
}

export function useLedger(): LedgerState {
  const [state, setState] = useState<LedgerState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refetch = () => setVersion((v) => v + 1);
    listeners.add(refetch);
    return () => {
      listeners.delete(refetch);
    };
  }, []);

  useEffect(() => {
    let live = true;
    getLedger().then(
      (ledger) => live && setState({ status: "ok", ledger }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [version]);

  return state;
}
