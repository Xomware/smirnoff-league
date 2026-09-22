"use client";

import { DrillLink } from "@/components/views/drill-link";
import { WeekIces } from "@/components/views/week-ices";
import { IceBadge } from "@/components/xp/IceBadge";
import { TeamName } from "@/components/xp/TeamName";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { byRoster } from "@/lib/league/drill";
import { useLeague } from "@/lib/league/use-league";

export function IcesWindow() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const error = leagueError ?? icesError;

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally) return <p role="status">Tallying the ices...</p>;

  return (
    <div className="grid gap-3">
      <div>
        <div className="xp-table-scroll">
          <table className="xp-table">
            <caption className="mb-2 text-left text-sm font-bold">Owed — provisional</caption>
            <thead>
              <tr>
                <th scope="col" className="w-12">#</th>
                <th scope="col">Team</th>
                <th scope="col" className="w-18 text-right">Owed</th>
              </tr>
            </thead>
            <tbody>
              {tally.owed.map((t, i) => (
                <tr key={t.rosterId}>
                  <td>{i + 1}</td>
                  <td className="md:max-w-0">
                    <DrillLink to={{ kind: "team", rosterId: t.rosterId }}>
                      <TeamName name={teamFor(t.rosterId).name} iced={t.total > 0} ices={0} />
                    </DrillLink>
                  </td>
                  <td className="text-right">
                    {t.total > 0 ? <IceBadge count={t.total} /> : <span className="tabular-nums">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xp-note mt-2">
          Owed from Sleeper scores for finished weeks. Completions and late ices arrive with the ledger.
        </p>
      </div>

      <section className="xp-group" aria-label={`Week ${currentWeek} — live, provisional`}>
        <h3 className="xp-group-title">Week {currentWeek} — live, provisional</h3>
        <p className="xp-note">Zeros and the lowest score lock in when the week ends. Only empty slots count now.</p>
        {!tally.live || tally.live.ices.length === 0 ? (
          <p>No empty slots this week.</p>
        ) : (
          <WeekIces groups={byRoster(tally.live.ices)} players={data.players} teamFor={teamFor} />
        )}
      </section>
      {[...tally.weeks].reverse().map(({ week, ices }) => (
        <section key={week} className="xp-group" aria-label={`Week ${week}`}>
          <h3 className="xp-group-title">Week {week}</h3>
          {ices.length === 0 ? (
            <p>No ices this week.</p>
          ) : (
            <WeekIces groups={byRoster(ices)} players={data.players} teamFor={teamFor} />
          )}
        </section>
      ))}
    </div>
  );
}
