import { useSyncExternalStore } from "react";

const KEY = "smirnoff:ticker-hidden";

let hidden: boolean | null = null;
const listeners = new Set<() => void>();

// Read once and kept in memory, like the mute switch, so a blocked storage
// still holds the choice for the session.
export function isTickerHidden(): boolean {
  if (hidden !== null) return hidden;
  try {
    hidden = window.localStorage.getItem(KEY) === "1";
  } catch {
    hidden = false;
  }
  return hidden;
}

export function setTickerHidden(value: boolean) {
  hidden = value;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Kept in memory above; it just won't survive a reload.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Shown on the server, so the bar's space is reserved from the first paint.
export const useTickerHidden = () => useSyncExternalStore(subscribe, isTickerHidden, () => false);
