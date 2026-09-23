"use client";

import Image from "next/image";
import { useContext } from "react";

import { DrillContext, DrillLink } from "@/components/views/drill-link";
import { IceBadge } from "@/components/xp/IceBadge";
import { IceBottleIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { useIceWatch } from "@/lib/ices/use-ice-watch";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { watchStates } from "@/lib/ices/watch";
import { useLeague } from "@/lib/league/use-league";
import { useWriteups } from "@/lib/writeups/use-writeups";

// Opens a window of its own on the desktop rather than navigating the small
// Home window in place; on the phone the drill context pushes a screen.
function EditionPanel() {
  const { state, onPageError } = useWriteups();
  const open = useContext(DrillContext);
  const latest = state.status === "ok" ? state.writeups[0] : undefined;

  return (
    <section aria-label="This Week's Edition" className="xp-inset shrink-0 p-2 sm:w-36">
      {state.status === "loading" ? (
        <p role="status">Checking the News Drop...</p>
      ) : state.status === "error" ? (
        <p role="alert">News Drop unavailable.</p>
      ) : !latest ? (
        <p className="italic">No edition yet. The commish is typing...</p>
      ) : (
        <button type="button" className="home-edition" onClick={() => open({ kind: "writeup", week: latest.week })}>
          <span className="font-bold">This Week&apos;s Edition</span>
          <Image unoptimized src={latest.pages[0]} alt="" width={140} height={181} onError={onPageError} />
          <span className="truncate">
            Week {latest.week}: {latest.title}
          </span>
        </button>
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
    <div className="flex flex-col gap-3 sm:flex-row md:h-full">
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
      <EditionPanel />
    </div>
  );
}
