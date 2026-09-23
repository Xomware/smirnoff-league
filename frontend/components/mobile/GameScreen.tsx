"use client";

import { DrillLink } from "@/components/views/drill-link";
import { TeamName } from "@/components/xp/TeamName";
import type { WindowParams } from "@/lib/desktop/windows";
import { WATCH_TAG } from "./MatchupCard";
import { useWeekGames } from "./use-week-games";

interface GameScreenProps {
  params: WindowParams;
}

export function GameScreen({ params }: GameScreenProps) {
  const week = Number(params.week);
  const { data, games, error, teamFor } = useWeekGames(week);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !games) return <p role="status">Loading the game...</p>;
  const game = games.find((g) => g.id === Number(params.matchup));
  if (!game) return <p className="m-empty">No such game in week {week}.</p>;

  const top = Math.max(...game.sides.map((s) => s.points));

  return (
    <div className="m-page">
      <section aria-label="Score" className="m-card m-scoreboard">
        {game.sides.map((side) => (
          <div key={side.rosterId} className="m-scoreboard-side">
            <DrillLink to={{ kind: "team", rosterId: side.rosterId }}>
              <TeamName name={teamFor(side.rosterId).name} avatarUrl={teamFor(side.rosterId).avatarUrl} iced={side.ices > 0} ices={side.ices} />
            </DrillLink>
            <span className={`m-big-score${top > 0 && side.points === top ? " m-score-top" : ""}`}>{side.points.toFixed(2)}</span>
          </div>
        ))}
      </section>
      {game.sides.map((side) => {
        const name = teamFor(side.rosterId).name;
        return (
          <section key={side.rosterId} aria-label={`${name} lineup`} className="m-section">
            <h2 className="m-section-title">{name}</h2>
            {side.starters === null ? (
              <p className="m-empty">Sleeper has no lineup for this team yet.</p>
            ) : (
              <ul className="m-card m-rows">
                {side.starters.map((s, i) => {
                  const tag = s.watch && WATCH_TAG[s.watch.state];
                  return (
                    <li key={i} className={`m-player${s.iced ? " ice" : ""}${s.watch?.state === "WATCH" ? " ice-watch" : ""}`}>
                      <span className="m-slot">{s.slot}</span>
                      <span className="m-player-name">
                        {s.playerId ? (
                          <DrillLink to={{ kind: "player", playerId: s.playerId }}>{data.players[s.playerId]?.name ?? s.playerId}</DrillLink>
                        ) : (
                          "Empty"
                        )}
                        {tag && (
                          <span className="m-chip" data-state={s.watch!.state}>
                            {tag}
                          </span>
                        )}
                      </span>
                      <span className="m-points">{s.points.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
