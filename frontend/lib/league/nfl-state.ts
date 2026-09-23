import { useSyncExternalStore } from "react";

import type { SleeperNflState } from "@/lib/sleeper/types";
import { nflState } from "./cache";

// `checked` changes on every successful read, so hooks that depend on the clock
// (the default week flips at Thursday kickoff) re-evaluate even when `nfl` is unchanged.
export type NflSnapshot =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; nfl: SleeperNflState; checked: number };

const LOADING: NflSnapshot = { status: "loading" };
const RECHECK_MS = 5 * 60_000;

let snapshot: NflSnapshot = LOADING;
let latest = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function read(fresh: boolean) {
  const mine = ++latest;
  nflState(fresh).then(
    (nfl) => {
      if (mine !== latest) return;
      // Same object while nothing changed, so league data and its memos stay put.
      const prev = snapshot.status === "ok" ? snapshot.nfl : null;
      const same = prev && JSON.stringify(prev) === JSON.stringify(nfl);
      snapshot = { status: "ok", nfl: same ? prev : nfl, checked: Date.now() };
      listeners.forEach((fn) => fn());
    },
    (e: Error) => {
      // A failed recheck keeps the week on screen; the next one retries.
      if (mine !== latest || snapshot.status === "ok") return;
      snapshot = { status: "error", message: e.message };
      listeners.forEach((fn) => fn());
    },
  );
}

const onVisible = () => document.visibilityState === "visible" && read(true);

// One poll for the whole app, running while anything on screen reads the week.
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    read(false);
    timer = setInterval(() => read(true), RECHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size) return;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function useNflState(): NflSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => LOADING);
}

export function clearNflState() {
  latest++;
  snapshot = LOADING;
}
