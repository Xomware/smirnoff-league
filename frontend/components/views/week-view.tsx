"use client";

import { TeamName } from "@/components/xp/TeamName";
import { weekSummary } from "@/lib/league/drill";
import { DrillLink } from "./drill-link";
import { OpenGame } from "./game-view";
import { useSeason, WeekIces } from "./week-ices";

interface WeekViewProps {
  week: number;
}

export function WeekView({ week }: WeekViewProps) {
  const { data, teamFor, currentWeek, finishedWeeks: weeks, liveMatchups: live, error } = useSeason();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !weeks || !live) return <p role="status">Loading week {week}...</p>;

  const isLive = week === currentWeek;
  const matchups = isLive ? live : (weeks.find((w) => w.week === week)?.matchups ?? []);
  const { pairs, icesByRoster, lowest } = weekSummary(week, matchups, isLive);
  if (pairs.length === 0) return <p className="xp-note">No matchups for week {week} yet.</p>;

  const icesOf = (rosterId: number) => icesByRoster.find(([id]) => id === rosterId)?.[1].length ?? 0;
  const team = (rosterId: number, ices = 0) => (
    <DrillLink to={{ kind: "team", rosterId }}>
      <TeamName name={teamFor(rosterId).name} iced={ices > 0} ices={ices} />
    </DrillLink>
  );

  return (
    <div className="grid gap-3">
      {lowest && (
        <p className="xp-note flex flex-wrap items-center gap-2">
          {isLive ? "Lowest score so far" : "Lowest score of the week"}:
          {lowest.rosterIds.map((id) => (
            <span key={id}>{team(id)}</span>
          ))}
          <span className="tabular-nums">{lowest.points.toFixed(2)}</span>
        </p>
      )}

      <ul aria-label="Matchups" className="grid gap-2 sm:grid-cols-2">
        {pairs.map((sides) => (
          <li key={sides[0].matchup_id} className="xp-bracket-match">
            {sides.map((s) => (
              <span key={s.roster_id} className="xp-matchup-side">
                {team(s.roster_id, icesOf(s.roster_id))}
                <span className="xp-score">{s.points.toFixed(2)}</span>
              </span>
            ))}
            <span className="text-right">
              <OpenGame week={week} matchup={sides[0].matchup_id!} />
            </span>
          </li>
        ))}
      </ul>

      <section aria-label="Ices" className="week-ices grid gap-3">
        <h3 className="font-bold">Ices</h3>
        {isLive && <p className="xp-note">Only empty slots count until the week ends.</p>}
        {icesByRoster.length === 0 ? (
          <p>No ices this week.</p>
        ) : (
          <WeekIces groups={icesByRoster} players={data.players} teamFor={teamFor} />
        )}
      </section>
    </div>
  );
}
