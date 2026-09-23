import { useSyncExternalStore } from "react";

type Resource<S extends { status: "ok" }> = { status: "loading" } | { status: "error"; message: string } | S;

const LOADING = { status: "loading" } as const;
const all: { clear: () => void }[] = [];

// One request per session, shared by every hook instance: Home, the tray, the
// board and the reel all read the same ledger. `maxAge` covers data that goes
// bad on its own, like presigned URLs.
export function sharedResource<S extends { status: "ok" }>(load: () => Promise<S>, maxAge = Infinity) {
  let state: Resource<S> = LOADING;
  let entry: { at: number } | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  function start() {
    const mine = { at: Date.now() };
    entry = mine;
    if (state.status === "error") state = LOADING;
    // A refresh replaces the entry, so a slower earlier response must not land.
    load().then(
      (value) => {
        if (entry !== mine) return;
        state = value;
        emit();
      },
      (e: Error) => {
        if (entry !== mine) return;
        entry = null;
        state = { status: "error", message: e.message };
        emit();
      },
    );
  }

  function subscribe(fn: () => void) {
    listeners.add(fn);
    if (!entry || Date.now() - entry.at > maxAge) start();
    return () => {
      listeners.delete(fn);
    };
  }

  const resource = {
    use: () => useSyncExternalStore(subscribe, () => state, () => LOADING as Resource<S>),
    refresh() {
      entry = null;
      if (listeners.size) start();
      emit();
    },
    age: () => (entry ? Date.now() - entry.at : Infinity),
    clear() {
      entry = null;
      state = LOADING;
    },
  };
  all.push(resource);
  return resource;
}

export function clearSharedResources() {
  all.forEach((r) => r.clear());
}
