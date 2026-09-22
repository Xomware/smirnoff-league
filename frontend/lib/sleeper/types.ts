export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  roster_positions: string[];
  settings: {
    playoff_week_start: number;
    playoff_teams: number;
    [key: string]: unknown;
  };
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: { team_name?: string; [key: string]: unknown } | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  co_owners: string[] | null;
  starters: string[];
  players: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    [key: string]: unknown;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  custom_points: number | null;
  starters: string[];
  starters_points: number[];
  players: string[] | null;
  players_points: Record<string, number> | null;
}

// `t1`/`t2` are roster ids once known; before that the `_from` fields say
// which earlier match feeds the slot.
export interface SleeperBracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
  p?: number;
}

export interface SleeperNflState {
  week: number;
  display_week: number;
  season: string;
  season_type: string;
  leg: number;
}
