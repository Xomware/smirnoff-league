"use client";

import { DrillLink } from "@/components/views/drill-link";
import { IceBadge } from "@/components/xp/IceBadge";
import { IceBottleIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useLeague } from "@/lib/league/use-league";

export function HomeWindow() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const error = leagueError ?? icesError;

  const liveByRoster = new Map<number, number>();
  for (const ice of tally?.live?.ices ?? []) {
    liveByRoster.set(ice.rosterId, (liveByRoster.get(ice.rosterId) ?? 0) + 1);
  }
  const watch = [...liveByRoster].sort(([, a], [, b]) => b - a);

  return (
    <div className="flex h-full gap-3">
      <div className="xp-inset hidden shrink-0 place-items-center p-3 sm:grid">
        <IceBottleIcon width={80} height={80} />
      </div>
      <div aria-live="polite" className="xp-inset min-w-0 flex-1 p-2">
        {error ? (
          <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
        ) : !data || !tally ? (
          <p role="status">Tallying the ices...</p>
        ) : (
          <>
            <dl className="xp-summary">
              <dt>Season</dt>
              <dd>{data.league.season}</dd>
              <dt>Season owed (provisional)</dt>
              <dd>{tally.owed.reduce((n, t) => n + t.total, 0)}</dd>
              <dt>Week</dt>
              <dd>{currentWeek}</dd>
              <dt>Ice Watch this week (live)</dt>
              <dd>{tally.live?.ices.length ?? 0}</dd>
            </dl>
            {watch.length === 0 ? (
              <p className="mt-2 text-(--xp-select) italic">Nobody is iced yet this week.</p>
            ) : (
              <ul aria-label="Ice Watch this week" className="mt-2 grid gap-1">
                {watch.map(([rosterId, count]) => (
                  <li key={rosterId} className="flex items-center justify-between gap-2">
                    <DrillLink to={{ kind: "team", rosterId }}>
                      <TeamName name={teamFor(rosterId).name} iced ices={0} />
                    </DrillLink>
                    <IceBadge count={count} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
