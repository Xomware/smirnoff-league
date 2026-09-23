"use client";

import { useEffect, useState } from "react";

import { getLedger, type Ledger } from "@/lib/api/ledger";

export type LedgerState = { status: "loading" } | { status: "ok"; ledger: Ledger } | { status: "error"; message: string };

const listeners = new Set<() => void>();

// Every open window holds its own copy, so an upload in one refetches them all.
export function refreshLedger() {
  listeners.forEach((fn) => fn());
}

export function useLedger(): LedgerState {
  const [state, setState] = useState<LedgerState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
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
