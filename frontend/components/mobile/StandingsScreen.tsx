"use client";

import { DrillLink } from "@/components/views/drill-link";
import { WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { dangerZone, sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

export function StandingsScreen() {
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const { tally } = useSeasonIces(data ? Math.max(1, data.nfl.week) : undefined);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data) return <p role="status">Loading the league...</p>;

  const rows = sortStandings(data.rosters);
  const playoffTeams = data.league.settings.playoff_teams;
  const danger = dangerZone(rows, playoffTeams, data.nfl.week);
  const owed = (rosterId: number) => tally?.owed.find((t) => t.rosterId === rosterId)?.total ?? 0;

  return (
    <div className="m-page">
      <ol aria-label={`League standings. The top ${playoffTeams} make the playoffs.`} className="m-card m-rows">
        {rows.map((s, i) => (
          <li key={s.rosterId} className={`m-row${s.rosterId === myRosterId ? " m-mine" : ""}`}>
            {i === playoffTeams && <span className="m-cut">Playoff cut</span>}
            <span className="m-rank">{i + 1}</span>
            <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
              <TeamName name={teamFor(s.rosterId).name} iced={owed(s.rosterId) > 0} ices={owed(s.rosterId)} isMine={s.rosterId === myRosterId} season />
            </DrillLink>
            <span className="m-record">
              {s.wins}-{s.losses}
              {s.ties > 0 && `-${s.ties}`}
            </span>
            <span className="m-row-sub">
              {s.pf.toFixed(2)} for · {s.pa.toFixed(2)} against
              {danger.has(s.rosterId) && (
                <span className="m-danger-chip">
                  <WarningIcon width={14} height={14} />
                  Danger zone
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {danger.size > 0 && <p className="m-caption">Danger zone: within one game of the playoff cut.</p>}
    </div>
  );
}
