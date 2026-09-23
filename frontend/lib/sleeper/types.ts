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
  // null when Sleeper has no lineup data for the roster yet (seen W3 2026);
  // an actual empty slot is "0".
  starters: string[] | null;
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

// `roster_id` is the pick's original owner; `owner_id` receives it in the trade.
export interface SleeperDraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

// `adds` maps player id to the roster receiving him, `drops` to the roster
// losing him. `leg` is the week.
export interface SleeperTransaction {
  transaction_id: string;
  type: "free_agent" | "waiver" | "trade" | "commissioner";
  status: "complete" | "failed";
  leg: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: SleeperDraftPick[];
  waiver_budget: { sender: number; receiver: number; amount: number }[];
  settings: { waiver_bid?: number; seq?: number } | null;
  creator: string;
  created: number;
  status_updated: number;
}

export interface SleeperNflState {
  week: number;
  display_week: number;
  season: string;
  season_type: string;
  leg: number;
}
