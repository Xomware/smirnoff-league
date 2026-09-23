"use client";

import { DrillLink } from "@/components/views/drill-link";
import { NewsList } from "@/components/views/news-list";
import { IceBadge } from "@/components/xp/IceBadge";
import { IceBottleIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { useIceWatch } from "@/lib/ices/use-ice-watch";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { watchStates } from "@/lib/ices/watch";
import { useLeague } from "@/lib/league/use-league";
import { useNews } from "@/lib/news/use-news";

function LatestNews() {
  const { data, teamFor, feed, error } = useNews();
  return (
    <section className="xp-group" aria-labelledby="latest-news">
      <h3 id="latest-news" className="xp-group-title flex items-baseline justify-between gap-2">
        Latest news
        <DrillLink to={{ kind: "news" }}>
          <span className="text-sm font-normal underline">All news</span>
        </DrillLink>
      </h3>
      {error ? (
        <p>News is unavailable right now.</p>
      ) : !data || !feed ? (
        <p role="status">Rolling the presses...</p>
      ) : feed.length === 0 ? (
        <p>No news yet.</p>
      ) : (
        <NewsList label="Latest news" items={feed.slice(0, 3)} players={data.players} teamFor={teamFor} />
      )}
    </section>
  );
}

export function HomeWindow() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const ledger = useLedger();
  const error = leagueError ?? icesError;
  const live = useIceWatch(currentWeek);
  const onWatch =
    data && currentWeek && live.matchups && live.games?.some((g) => g.state === "in")
      ? watchStates(currentWeek, live.matchups, live.games, data.players).reduce((n, t) => n + t.locked + t.watch + t.finalIce, 0)
      : null;

  const liveByRoster = new Map<number, number>();
  for (const ice of tally?.live?.ices ?? []) {
    liveByRoster.set(ice.rosterId, (liveByRoster.get(ice.rosterId) ?? 0) + 1);
  }
  const watch = [...liveByRoster].sort(([, a], [, b]) => b - a);

  return (
    <div className="grid gap-3">
      <div className="flex gap-3">
        <div className="xp-inset hidden shrink-0 place-items-center p-3 sm:grid">
          <IceBottleIcon width={80} height={80} />
        </div>
        <div aria-live="polite" className="xp-inset min-w-0 flex-1 p-2">
          {error ? (
            <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
          ) : !data || !tally || ledger.status === "loading" ? (
            <p role="status">Tallying the ices...</p>
          ) : (
            <>
              <dl className="xp-summary">
                <dt>Season</dt>
                <dd>{data.league.season}</dd>
                {ledger.status === "ok" ? (
                  <>
                    <dt>Season ices owed</dt>
                    <dd>{ledger.ledger.summary.reduce((n, s) => n + s.owed + s.lateOwed, 0)}</dd>
                  </>
                ) : (
                  <>
                    <dt>Season owed (provisional)</dt>
                    <dd>{tally.owed.reduce((n, t) => n + t.total, 0)}</dd>
                  </>
                )}
                <dt>Week</dt>
                <dd>{currentWeek}</dd>
                <dt>Ice Watch this week (live)</dt>
                <dd>{onWatch ?? tally.live?.ices.length ?? 0}</dd>
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
      <LatestNews />
    </div>
  );
}
