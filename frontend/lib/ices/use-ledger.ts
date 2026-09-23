"use client";

import { useEffect, useState } from "react";

import { getLedger, type Ledger } from "@/lib/api/ledger";

export type LedgerState = { status: "loading" } | { status: "ok"; ledger: Ledger } | { status: "error"; message: string };

export function useLedger(): LedgerState {
  const [state, setState] = useState<LedgerState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    getLedger().then(
      (ledger) => live && setState({ status: "ok", ledger }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, []);

  return state;
}
