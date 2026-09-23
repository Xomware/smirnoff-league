"use client";

import { useCallback } from "react";

import { listWriteups, type Writeup } from "@/lib/api/writeups";
import { sharedResource } from "@/lib/shared-resource";

export type WriteupsState = { status: "loading" } | { status: "ok"; writeups: Writeup[] } | { status: "error"; message: string };

// Presigned page GETs expire an hour after the list call; refetch well before that.
const MAX_AGE_MS = 50 * 60_000;
// Long enough that a page that is simply broken cannot loop the list call.
const STALE_MS = 60_000;

const writeups = sharedResource(() => listWriteups().then((w) => ({ status: "ok" as const, writeups: w })), MAX_AGE_MS);

export const refreshWriteups = writeups.refresh;

export function useWriteups() {
  const state: WriteupsState = writeups.use();

  // An <img> error carries no status, so treat a failure on an old list as an
  // expired presigned URL. Every page fails at once; the refresh resets the age.
  const onPageError = useCallback(() => {
    if (writeups.age() >= STALE_MS) refreshWriteups();
  }, []);

  return { state, refresh: refreshWriteups, onPageError };
}
