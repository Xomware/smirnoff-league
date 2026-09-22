"use client";

import { Fragment, useMemo } from "react";

import { StandingsIcon, WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import { dangerZone, sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

export default function StandingsPage() {
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const playoffTeams = data?.league.settings.playoff_teams ?? 0;

  const rows = useMemo(() => (data ? sortStandings(data.rosters) : []), [data]);
  const danger = useMemo(() => dangerZone(rows, playoffTeams), [rows, playoffTeams]);

  return (
    <main className="xp-page">
      <Window title="Standings" icon={<StandingsIcon />} controls>
        {error ? (
          <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
        ) : !data ? (
          <p role="status">Loading the league...</p>
        ) : (
          <>
            <table className="xp-table">
              <caption className="sr-only">
                League standings. The top {playoffTeams} make the playoffs.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12">#</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="w-14">W-L</th>
                  <th scope="col" className="w-18 text-right">PF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <Fragment key={s.rosterId}>
                    {i === playoffTeams && (
                      <tr className="xp-cut">
                        <td colSpan={4}>Playoff cut</td>
                      </tr>
                    )}
                    <tr className={danger.has(s.rosterId) ? "xp-danger" : undefined}>
                      <td>
                        <span className="flex items-center gap-1">
                          {i + 1}
                          {danger.has(s.rosterId) && (
                            <WarningIcon className="shrink-0" role="img" aria-hidden={false} aria-label="Danger zone" />
                          )}
                        </span>
                      </td>
                      <td className="max-w-0">
                        <TeamName
                          name={teamFor(s.rosterId).name}
                          iced={false}
                          ices={0}
                          isMine={s.rosterId === myRosterId}
                        />
                      </td>
                      <td className="tabular-nums">
                        {s.wins}-{s.losses}
                        {s.ties > 0 && `-${s.ties}`}
                      </td>
                      <td className="text-right tabular-nums">{s.pf.toFixed(2)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex items-center gap-1">
              <WarningIcon />
              Danger zone: within one game of the playoff cut.
            </p>
          </>
        )}
      </Window>
    </main>
  );
}
