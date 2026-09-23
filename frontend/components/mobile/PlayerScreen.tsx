"use client";

import { DrillLink } from "@/components/views/drill-link";
import { useSeason } from "@/components/views/week-ices";
import { TeamName } from "@/components/xp/TeamName";
import type { WindowParams } from "@/lib/desktop/windows";
import { repeatOffenders } from "@/lib/ices/stats";
import { playerWeeks } from "@/lib/league/drill";

export function PlayerScreen({ params }: { params: WindowParams }) {
  const playerId = String(params.playerId);
  const { data, teamFor, finishedWeeks: weeks, error } = useSeason();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !weeks) return <p role="status">Loading the player...</p>;

  const info = data.players[playerId];
  const log = playerWeeks(weeks, playerId);
  const repeat = repeatOffenders(weeks).find((o) => o.playerId === playerId);

  return (
    <div className="m-page">
      <section aria-label={info?.name ?? playerId} className="m-card m-player-head">
        <p className="m-edition-title">{info?.name ?? playerId}</p>
        <p className="m-caption">{[info?.position, info?.team].filter(Boolean).join(" · ") || "Free agent"}</p>
        {repeat && (
          <p className="m-danger-chip">
            Repeat Offender: {repeat.count} ices, weeks {repeat.weeks.join(", ")}
          </p>
        )}
      </section>
      <section aria-labelledby="m-player-weeks" className="m-section">
        <h2 id="m-player-weeks" className="m-section-title">
          Week by week
        </h2>
        {log.length === 0 ? (
          <p className="m-empty">Not on a league roster in a finished week.</p>
        ) : (
          <ul aria-label="Week by week" className="m-card m-rows">
            {log.map((w) => (
              <li key={w.week} className={`m-row${w.ice ? " ice" : ""}`}>
                <DrillLink to={{ kind: "week", week: w.week }}>Week {w.week}</DrillLink>
                <span className="m-points">{w.points.toFixed(2)}</span>
                <span className="m-row-sub m-flush">
                  <DrillLink to={{ kind: "team", rosterId: w.rosterId }}>
                    <TeamName name={teamFor(w.rosterId).name} iced={false} ices={0} />
                  </DrillLink>
                  {w.started ? "Starter" : "Bench"}
                  {w.ice && <b className="m-minus">Caused an ice</b>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
