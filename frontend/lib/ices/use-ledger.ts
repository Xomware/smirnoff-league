"use client";

import { getLedger, type Ledger } from "@/lib/api/ledger";
import { sharedResource } from "@/lib/shared-resource";

export type LedgerState = { status: "loading" } | { status: "ok"; ledger: Ledger } | { status: "error"; message: string };

const ledger = sharedResource(() => getLedger().then((l) => ({ status: "ok" as const, ledger: l })));

// Admin edits and video uploads call this so every open ledger view refetches,
// not only the window that made the change.
export const refreshLedger = ledger.refresh;

export const useLedger = (): LedgerState => ledger.use();
