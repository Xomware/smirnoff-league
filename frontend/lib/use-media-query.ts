"use client";

import { useCallback, useSyncExternalStore } from "react";

// Matches the phone breakpoint in the CSS.
export const PHONE = "(max-width: 767.98px)";

// The server snapshot is false, but the app shell only renders once a user is
// signed in on the client, so the prerendered HTML never holds a guess.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
