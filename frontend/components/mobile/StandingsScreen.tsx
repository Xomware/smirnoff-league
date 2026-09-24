"use client";

import { BoardHead } from "@/components/views/board";
import { DrillLink } from "@/components/views/drill-link";
import { WarningIcon } from "@/components/xp/icons";
import { IceBadge } from "@/components/xp/IceBadge";
import { TeamName, TroubleTags } from "@/components/xp/TeamName";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useTrouble } from "@/lib/ices/use-trouble";
import { dangerZone, sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

export function StandingsScreen() {
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const { tally } = useSeasonIces(data ? Math.max(1, data.nfl.week) : undefined);
  const trouble = useTrouble();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data) return <p role="status">Loading the league...</p>;

  const rows = sortStandings(data.rosters);
  const playoffTeams = data.league.settings.playoff_teams;
  const danger = dangerZone(rows, playoffTeams, data.nfl.week);
  const owed = (rosterId: number) => tally?.owed.find((t) => t.rosterId === rosterId)?.total ?? 0;
  // The sub line has room for one badge: Glacier's Owes/Late tag says it, else the ice count.
  const badge = (rosterId: number) => {
    const tags = trouble.of(rosterId);
    return tags.length ? <TroubleTags trouble={tags} /> : <IceBadge count={owed(rosterId)} season />;
  };

  return (
    <div className="m-page">
      <div className="m-card m-rows m-standings">
        <BoardHead labels={["RK", "Team", "W-L", "PF"]} />
        <ol aria-label={`League standings. The top ${playoffTeams} make the playoffs.`}>
          {rows.map((s, i) => (
            <li key={s.rosterId} className={`board-row${s.rosterId === myRosterId ? " m-mine" : ""}`}>
              {i === playoffTeams && <span className="m-cut">Playoff cut</span>}
              <span className="board-rank m-rank">{i + 1}</span>
              <span className="board-who">
                <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
                  <TeamName name={teamFor(s.rosterId).name} iced={owed(s.rosterId) > 0} ices={owed(s.rosterId)} isMine={s.rosterId === myRosterId} badges={false} />
                </DrillLink>
                <span className="board-sub">
                  <span>
                    <span aria-hidden="true">PA </span>
                    <span className="sr-only">Points against </span>
                    {s.pa.toFixed(2)}
                  </span>
                  {badge(s.rosterId)}
                  {danger.has(s.rosterId) && (
                    <span className="m-danger-chip">
                      <WarningIcon width={14} height={14} />
                      Danger zone
                    </span>
                  )}
                </span>
              </span>
              <span className="board-num">
                {s.wins}-{s.losses}
                {s.ties > 0 && `-${s.ties}`}
              </span>
              <span className="board-num">
                <span className="sr-only">Points for </span>
                {s.pf.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {danger.size > 0 && <p className="m-caption">Danger zone: within one game of the playoff cut.</p>}
    </div>
  );
}
