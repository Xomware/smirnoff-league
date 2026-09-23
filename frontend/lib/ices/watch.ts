import type { Game } from "@/lib/espn";
import type { Player } from "@/lib/league/use-league";
import { iceId, type MatchupRow, SLOTS } from "./compute";

export type WatchState = "LOCKED" | "WATCH" | "SAFE" | "FINAL_ICE" | "FINAL_SAFE";

export const WATCH_TAG: Partial<Record<WatchState, string>> = { FINAL_ICE: "ICED", WATCH: "WATCH", LOCKED: "LOCKED" };

export interface StarterWatch {
  // Same id weekIces gives this slot's ice.
  id: string;
  slot: string;
  playerId: string | null;
  points: number;
  state: WatchState;
  // null for an empty slot or a team on bye.
  game: Game | null;
}

export interface TeamWatch {
  rosterId: number;
  starters: StarterWatch[];
  locked: number;
  watch: number;
  finalIce: number;
}

// Sleeper's injury_status values for a player who won't suit up ("Sus" is suspended).
const SIDELINED = new Set(["Out", "IR", "PUP", "Sus"]);

function stateFor(points: number, game: Game | null, player: Player | undefined): WatchState {
  if (!game) return "LOCKED";
  if (game.completed) return points <= 0 ? "FINAL_ICE" : "FINAL_SAFE";
  // Only before kickoff: a player hurt mid-game and moved to IR still keeps his points.
  if (game.state === "pre") return SIDELINED.has(player?.injury_status ?? "") ? "LOCKED" : "SAFE";
  const pastHalf = game.period >= 3 || game.status === "STATUS_HALFTIME";
  return pastHalf && points < 1 ? "WATCH" : "SAFE";
}

export function watchStates(
  week: number,
  matchups: MatchupRow[],
  games: Game[],
  players: Record<string, Player>,
): TeamWatch[] {
  const gameOf = new Map(games.flatMap((g) => g.teams.map((team) => [team, g] as const)));

  return matchups
    .filter((m) => m.starters !== null)
    .map((m) => {
      const starters = SLOTS.map((slot, i): StarterWatch => {
        const raw = m.starters![i];
        const playerId = raw === undefined || raw === "0" ? null : raw;
        const points = m.starters_points[i] ?? 0;
        // A defense's player id is its team abbreviation.
        const team = playerId && (players[playerId]?.team ?? playerId);
        const game = (team && gameOf.get(team)) || null;
        const state = playerId ? stateFor(points, game, players[playerId]) : "LOCKED";
        return { id: iceId(week, m.roster_id, `S${i}`), slot, playerId, points, state, game };
      });
      const count = (state: WatchState) => starters.filter((s) => s.state === state).length;
      return { rosterId: m.roster_id, starters, locked: count("LOCKED"), watch: count("WATCH"), finalIce: count("FINAL_ICE") };
    });
}
