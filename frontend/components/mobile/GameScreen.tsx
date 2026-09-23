"use client";

import { DrillLink } from "@/components/views/drill-link";
import { IceCause } from "@/components/views/week-ices";
import { TeamName } from "@/components/xp/TeamName";
import type { WindowParams } from "@/lib/desktop/windows";
import { useWeekGames } from "@/lib/league/use-week-games";
import { WATCH_TAG } from "./MatchupCard";

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
  const player = (id: string) => <DrillLink to={{ kind: "player", playerId: id }}>{data.players[id]?.name ?? id}</DrillLink>;

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
                        {s.playerId ? player(s.playerId) : "Empty"}
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
            {side.bench && side.bench.length > 0 && (
              <>
                <h3 className="m-caption">Bench</h3>
                <ul aria-label={`${name} bench`} className="m-card m-rows">
                  {side.bench.map((p) => (
                    <li key={p.playerId} className="m-player">
                      <span className="m-slot">BN</span>
                      <span className="m-player-name">{player(p.playerId)}</span>
                      <span className="m-points">{p.points.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {side.benchLeft !== null && <p className="m-caption">{side.benchLeft.toFixed(2)} left on the bench</p>}
            {side.iceList.length > 0 && (
              <>
                <h3 className="m-caption">Ices</h3>
                <ul aria-label={`${name} ices`} className="m-card m-rows">
                  {side.iceList.map((ice) => (
                    <li key={ice.id} className="m-player ice">
                      <span className="m-slot">{ice.slot ?? "TEAM"}</span>
                      <span className="m-player-name">
                        <IceCause ice={ice} players={data.players} />
                      </span>
                      <span className="m-points">{ice.points.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
