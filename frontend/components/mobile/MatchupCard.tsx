"use client";

import { TeamName } from "@/components/xp/TeamName";
import type { WatchState } from "@/lib/ices/watch";
import type { Player, Team } from "@/lib/league/use-league";
import type { Game, Starter } from "@/lib/league/use-week-games";
import { useProfile } from "@/lib/profile/use-profile";
import { usePush } from "./push";

export const WATCH_TAG: Partial<Record<WatchState, string>> = { FINAL_ICE: "Iced", WATCH: "Watch", LOCKED: "Locked", OPEN: "Fix lineup" };
const RANK: Partial<Record<WatchState, number>> = { FINAL_ICE: 0, WATCH: 1, LOCKED: 2, OPEN: 3 };

const flagged = (starters: Starter[] | null) =>
  (starters ?? []).filter((s) => s.watch && RANK[s.watch.state] !== undefined).sort((a, b) => RANK[a.watch!.state]! - RANK[b.watch!.state]!);

interface MatchupCardProps {
  week: number;
  game: Game;
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
  // Home's scroll row leaves the Ice Watch lines to the Games tab.
  compact?: boolean;
}

export function MatchupCard({ week, game, players, teamFor, compact = false }: MatchupCardProps) {
  const push = usePush();
  const { myRosterId } = useProfile();
  const top = Math.max(...game.sides.map((s) => s.points));
  const scored = top > 0;

  return (
    <button
      type="button"
      className={`m-matchup${compact ? " m-matchup-compact" : ""}`}
      onClick={() => push({ kind: "game", params: { week, matchup: game.id } })}
    >
      {game.sides.map((side) => {
        const watch = compact ? [] : flagged(side.starters);
        return (
          <span key={side.rosterId} className="m-matchup-side">
            <span className="m-matchup-team">
              <TeamName name={teamFor(side.rosterId).name} iced={side.ices > 0} ices={side.ices} isMine={side.rosterId === myRosterId} />
              <span className={`m-score${scored && side.points === top ? " m-score-top" : ""}`}>{side.points.toFixed(2)}</span>
            </span>
            {watch.length > 0 && (
              <span className="m-watch-line">
                {watch.map((s) => (
                  <span key={s.watch!.id} className="m-chip" data-state={s.watch!.state}>
                    <b>{WATCH_TAG[s.watch!.state]}</b> {s.playerId ? (players[s.playerId]?.name ?? s.playerId) : `Empty ${s.slot}`}
                  </span>
                ))}
              </span>
            )}
          </span>
        );
      })}
    </button>
  );
}
