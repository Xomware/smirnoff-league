import { getLeague, getMatchups, getNflState, getRosters, getTransactions, getUsers } from "@/lib/sleeper/client";
import type { SleeperMatchup, SleeperTransaction } from "@/lib/sleeper/types";
import type { Player } from "./use-league";

// Every window reads the same league, so one promise per endpoint serves the
// whole session. Finished weeks never change (stat corrections are ignored);
// the live week and nfl/state do, so they expire.
const LIVE_TTL = 30_000;
const NFL_TTL = 5 * 60_000;

interface Entry {
  promise: Promise<unknown>;
  expires: number;
}

const entries = new Map<string, Entry>();

function cached<T>(key: string, load: () => Promise<T>, ttl = Infinity): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;
  const promise = load();
  const entry = { promise, expires: Date.now() + ttl };
  entries.set(key, entry);
  // A failure is dropped so the next caller retries instead of reusing the rejection.
  promise.catch(() => entries.get(key) === entry && entries.delete(key));
  return promise;
}

async function getPlayers(): Promise<Record<string, Player>> {
  const res = await fetch("/data/players.json");
  if (!res.ok) throw new Error(`players.json: ${res.status}`);
  return (await res.json()) as Record<string, Player>;
}

export const league = () => cached("league", getLeague);
export const users = () => cached("users", getUsers);
export const rosters = () => cached("rosters", getRosters);
export const players = () => cached("players", getPlayers);
export const nflState = () => cached("nfl", getNflState, NFL_TTL);

export function leagueMatchups(week: number, live: boolean, fresh = false): Promise<SleeperMatchup[]> {
  const key = `matchups/${week}`;
  if (fresh) entries.delete(key);
  return cached(key, () => getMatchups(week), live ? LIVE_TTL : Infinity);
}

// A past week's transactions are settled; the current week's keep arriving.
export function leagueTransactions(week: number, live: boolean): Promise<SleeperTransaction[]> {
  return cached(`transactions/${week}`, () => getTransactions(week), live ? LIVE_TTL : Infinity);
}

export function clearLeagueCache() {
  entries.clear();
}
