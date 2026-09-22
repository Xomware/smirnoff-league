import type {
  SleeperBracketMatch,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperRoster,
  SleeperUser,
} from "./types";

export const SLEEPER_BASE = "https://api.sleeper.app/v1";
export const LEAGUE_ID = "1394061072742227968";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_BASE}${path}`);
  if (!res.ok) throw new Error(`Sleeper ${path}: ${res.status}`);
  return (await res.json()) as T;
}

const league = `/league/${LEAGUE_ID}`;

export const getLeague = () => get<SleeperLeague>(league);
export const getUsers = () => get<SleeperUser[]>(`${league}/users`);
export const getRosters = () => get<SleeperRoster[]>(`${league}/rosters`);
export const getMatchups = (week: number) => get<SleeperMatchup[]>(`${league}/matchups/${week}`);
export const getWinnersBracket = () => get<SleeperBracketMatch[]>(`${league}/winners_bracket`);
export const getLosersBracket = () => get<SleeperBracketMatch[]>(`${league}/losers_bracket`);
export const getNflState = () => get<SleeperNflState>("/state/nfl");
