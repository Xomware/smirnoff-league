"use client";

import Image from "next/image";
import { useContext } from "react";

import { ChugBoard } from "@/components/home/ChugBoard";
import { ChugReel } from "@/components/home/ChugReel";
import { DrillContext, DrillLink } from "@/components/views/drill-link";
import { IceBadge } from "@/components/xp/IceBadge";
import { TeamName } from "@/components/xp/TeamName";
import { currentWeek as ledgerWeek } from "@/lib/ices/chug-board";
import { type IceStanding, iceStandings } from "@/lib/ices/standings";
import { useIceWatch } from "@/lib/ices/use-ice-watch";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { watchStates } from "@/lib/ices/watch";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { type Team, useLeague } from "@/lib/league/use-league";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";
import { useVideos } from "@/lib/videos/use-videos";
import { useWriteups } from "@/lib/writeups/use-writeups";

import "./home.css";

interface TeamsProps {
  teamFor: (rosterId: number) => Team;
}

interface WhoOwesProps extends TeamsProps {
  owed: [rosterId: number, count: number][];
  provisional: boolean;
}

function WhoOwes({ owed, provisional, teamFor }: WhoOwesProps) {
  return (
    <section className="xp-group" aria-labelledby="home-owes">
      <h3 id="home-owes" className="xp-group-title flex items-baseline justify-between gap-2">
        {provisional ? "Who owes (provisional)" : "Who owes"}
        <DrillLink to={{ kind: "ices" }}>
          <span className="text-sm font-normal underline">Ice Ledger</span>
        </DrillLink>
      </h3>
      {owed.length === 0 ? (
        <p className="italic">Nobody owes an ice. Enjoy it while it lasts.</p>
      ) : (
        <ul aria-label="Who owes" className="home-owes">
          {owed.map(([rosterId, count]) => (
            <li key={rosterId}>
              <DrillLink to={{ kind: "team", rosterId }}>
                <TeamName name={teamFor(rosterId).name} iced ices={0} />
              </DrillLink>
              <span className="home-owed">
                {count}
                <span className="sr-only"> owed</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface IceLeadersProps extends TeamsProps {
  rows: IceStanding[];
}

// The phone has no Ice Standings window beside Home, so Home carries its top five.
function IceLeaders({ rows, teamFor }: IceLeadersProps) {
  return (
    <section className="xp-group" aria-labelledby="home-leaders">
      <h3 id="home-leaders" className="xp-group-title flex items-baseline justify-between gap-2">
        Ice Standings
        <DrillLink to={{ kind: "ice-standings" }}>
          <span className="text-sm font-normal underline">Full standings</span>
        </DrillLink>
      </h3>
      <ol aria-label="Ice Standings leaders" className="grid gap-1">
        {rows.slice(0, 5).map((r) => (
          <li key={r.rosterId} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums">{r.rank}</span>
            <DrillLink to={{ kind: "team", rosterId: r.rosterId }}>
              <TeamName name={teamFor(r.rosterId).name} iced={r.total > 0} ices={r.total} season />
            </DrillLink>
          </li>
        ))}
      </ol>
    </section>
  );
}


// Phone only: the desktop's default layout already opens the News Drop window.
function EditionPanel() {
  const { state, onPageError } = useWriteups();
  const open = useContext(DrillContext);
  const latest = state.status === "ok" ? state.writeups[0] : undefined;

  return (
    <section aria-label="This Week's Edition" className="xp-inset shrink-0 p-2 sm:w-56">
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
          <span className="line-clamp-3">
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
  const { tally, finishedWeeks, error: icesError } = useSeasonIces(currentWeek);
  const ledger = useLedger();
  const { state: videos, onVideoError } = useVideos();
  const phone = useMediaQuery(PHONE);
  const error = leagueError ?? icesError;
  const live = useIceWatch(currentWeek);
  const watching =
    data && currentWeek && live.matchups && live.games?.some((g) => g.state === "in")
      ? watchStates(currentWeek, live.matchups, live.games, data.players).map(
          (t): [number, number] => [t.rosterId, t.locked + t.watch + t.finalIce],
        )
      : null;
  const onWatch = watching?.reduce((n, [, count]) => n + count, 0);

  const week = useDefaultWeek(data?.nfl);
  const started = week === currentWeek;
  const weekIces = started ? tally?.live?.ices : tally?.weeks.find((w) => w.week === week)?.ices;

  const byRoster = new Map<number, number>();
  for (const ice of weekIces ?? []) {
    byRoster.set(ice.rosterId, (byRoster.get(ice.rosterId) ?? 0) + 1);
  }
  // During live games the list is Ice Watch's count per team, not only the ices already locked in.
  const watch = (watching ?? [...byRoster]).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a);

  const owed: [number, number][] =
    ledger.status === "ok"
      ? ledger.ledger.summary.map((s) => [s.rosterId, s.owed + s.lateOwed])
      : (tally?.owed.map((t) => [t.rosterId, t.total]) ?? []);
  const owing = owed.filter(([, n]) => n > 0).sort(([a, x], [b, y]) => y - x || a - b);
  const pf = data && Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
  const leaders =
    phone && pf && tally && finishedWeeks && ledger.status !== "loading"
      ? iceStandings(tally, finishedWeeks, pf, ledger.status === "ok" ? ledger.ledger.summary : null)
      : null;

  return (
    <div className="grid gap-3">
      {ledger.status === "ok" && (
        <div className="home-chugs">
          <div className="home-chugs-grid">
            <ChugBoard ledger={ledger.ledger} videos={videos.status === "ok" ? videos.videos : []} onVideoError={onVideoError} />
            <ChugReel week={ledgerWeek(ledger.ledger)} videos={videos} onVideoError={onVideoError} />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="home-mascot xp-inset hidden shrink-0 place-items-center p-2 sm:grid">
          <Image src="/brand/mascot.png" alt="The league mascot, a robot chugging a Smirnoff Ice" width={110} height={121} />
        </div>
        <div aria-live="polite" className="xp-inset min-w-0 flex-1 p-2">
          {error ? (
            <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
          ) : !data || !tally || week === undefined || ledger.status === "loading" ? (
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
                <dd>{week}</dd>
                {started ? (
                  <>
                    <dt>Ice Watch this week (live)</dt>
                    <dd>{onWatch ?? tally.live?.ices.length ?? 0}</dd>
                  </>
                ) : (
                  <>
                    <dt>Ices in week {week}</dt>
                    <dd>{weekIces?.length ?? 0}</dd>
                  </>
                )}
              </dl>
              {watch.length === 0 ? (
                <p className="mt-2 text-(--xp-select) italic">
                  {started ? "Nobody is iced yet this week." : `Nobody was iced in week ${week}.`}
                </p>
              ) : (
                <ul aria-label={started ? "Ice Watch this week" : `Ices in week ${week}`} className="mt-2 grid gap-1">
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
      {leaders && <IceLeaders rows={leaders} teamFor={teamFor} />}
      {tally && ledger.status !== "loading" && (
        <WhoOwes owed={owing} provisional={ledger.status !== "ok"} teamFor={teamFor} />
      )}
      {phone && <EditionPanel />}
    </div>
  );
}
