"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listWriteups, type Writeup } from "@/lib/api/writeups";

export type WriteupsState = { status: "loading" } | { status: "ok"; writeups: Writeup[] } | { status: "error"; message: string };

// Long enough that a page that is simply broken cannot loop the list call.
const STALE_MS = 60_000;

export function useWriteups() {
  const [state, setState] = useState<WriteupsState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const requestedAt = useRef(0);

  useEffect(() => {
    let live = true;
    requestedAt.current = Date.now();
    listWriteups().then(
      (writeups) => live && setState({ status: "ok", writeups }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // An <img> error carries no status, so treat a failure on an old list as an
  // expired presigned URL. Every page on the list fails at once, so bump the
  // clock here rather than on the next render.
  const onPageError = useCallback(() => {
    if (Date.now() - requestedAt.current < STALE_MS) return;
    requestedAt.current = Date.now();
    refresh();
  }, [refresh]);

  return { state, refresh, onPageError };
}
