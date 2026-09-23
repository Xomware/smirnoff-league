"use client";

import Image from "next/image";
import { type ReactNode, type Ref, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ChugBoard } from "@/components/home/ChugBoard";
import { ChugReel } from "@/components/home/ChugReel";
import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChug } from "@/components/videos/UploadChug";
import { DrillContext } from "@/components/views/drill-link";
import { currentWeek, myDue } from "@/lib/ices/chug-board";
import { iceStandings } from "@/lib/ices/standings";
import { type LedgerState, useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useWeekGames } from "@/lib/league/use-week-games";
import { useProfile } from "@/lib/profile/use-profile";
import { useVideos } from "@/lib/videos/use-videos";
import { Crystal, Icicles, PANEL_ICICLES } from "./Frost";

import "./glacier-home.css";

const TOP = 5;

interface PanelProps {
  label: string;
  className: string;
  children: ReactNode;
  // The chug panel's board and reel bring their own headings.
  heading?: boolean;
  aside?: ReactNode;
}

function Panel({ label, className, children, heading = true, aside }: PanelProps) {
  return (
    <section aria-label={label} className={`glacier-panel gh-panel ${className}`}>
      <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
      <Crystal />
      {heading && (
        <div className="gh-head">
          <h2>{label}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function lede(ledger: LedgerState): string {
  const deadline = "Chug by Sunday at 1:00 PM ET, on camera, or it goes late.";
  if (ledger.status !== "ok") return deadline;
  const week = currentWeek(ledger.ledger);
  if (!week) return "No ices on the board yet. Start a zero and that changes.";
  const n = ledger.ledger.ices.filter((i) => i.week === week && i.reason !== "late").length;
  if (!n) return `Week ${week} left no ices on the board.`;
  return `Week ${week} left ${n} ${n === 1 ? "ice" : "ices"} on the board. ${deadline}`;
}

export function YourIces() {
  const ledger = useLedger();
  const { data, teamFor } = useLeague();
  const { myRosterId, setEditing } = useProfile();
  const [upload, setUpload] = useState(false);
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const now = useNow(ok?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);
  const due = ok && myRosterId !== null ? myDue(ok, myRosterId, now) : null;
  const pill = due?.when && (
    <span className="gh-due" data-level={due.level}>
      {due.when}
    </span>
  );

  const body = () => {
    if (ledger.status === "loading") return <p role="status">Checking the ledger...</p>;
    if (ledger.status === "error") return <p role="alert">The ledger is unavailable ({ledger.message}).</p>;
    if (myRosterId === null) {
      return (
        <>
          <p>Claim your team to see what you owe.</p>
          <button type="button" className="gh-button" onClick={() => setEditing(true)}>
            Pick your team
          </button>
        </>
      );
    }
    if (!due) return <p className="gh-quiet">You&apos;re square. Nothing owed.</p>;
    const owed = ledger.ledger.ices.filter((i) => due.iceIds.includes(i.iceId)).sort((a, b) => a.week - b.week);
    return (
      <>
        <p className="gh-owe">
          <span className="gh-owe-count">{due.count}</span>
          <span>
            owed
            <br />
            {teamFor(myRosterId).name}
          </span>
        </p>
        <ul aria-label="Your owed ices" className="gh-rows">
          {owed.map((ice) => (
            <li key={ice.iceId}>
              W{ice.week} · {iceCauseText(ice, data?.players ?? {})}
            </li>
          ))}
        </ul>
        <button type="button" className="gh-button gh-button-go" onClick={() => setUpload(true)}>
          Upload your chug
        </button>
        {upload &&
          createPortal(
            // One video covers one week, so the oldest week's ices come ticked.
            <UploadChug
              ices={ledger.ledger.ices}
              initialIceIds={owed.filter((i) => i.week === owed[0].week).map((i) => i.iceId)}
              onClose={() => setUpload(false)}
            />,
            document.body,
          )}
      </>
    );
  };

  return (
    <Panel label="Your ices" className="gh-mine" aside={pill}>
      {body()}
    </Panel>
  );
}

export function Chugs() {
  const ledger = useLedger();
  const { state: videos, onVideoError } = useVideos();
  return (
    // A snowball splat would land on top of the clips.
    <Panel label="Chugs" className="gh-chugs" heading={false}>
      <div data-no-snowball className="gh-chugs-grid">
        {ledger.status === "loading" ? (
          <p role="status">Checking the ledger...</p>
        ) : ledger.status === "error" ? (
          <p role="alert">The ledger is unavailable ({ledger.message}).</p>
        ) : (
          <>
            <ChugBoard ledger={ledger.ledger} videos={videos.status === "ok" ? videos.videos : []} onVideoError={onVideoError} />
            <ChugReel week={currentWeek(ledger.ledger)} videos={videos} onVideoError={onVideoError} />
          </>
        )}
      </div>
    </Panel>
  );
}

export function WeekGames({ week }: { week: number | undefined }) {
  const { data, games, teamFor, error } = useWeekGames(week);
  const { myRosterId } = useProfile();
  const open = useContext(DrillContext);
  const title = week === undefined ? "This week's games" : `Week ${week} games`;
  const all = (
    <button type="button" className="gh-link" onClick={() => open({ kind: "watch" })}>
      All games
    </button>
  );

  return (
    <Panel label={title} className="gh-games" aside={all}>
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !data || !games || week === undefined ? (
        <p role="status">Loading the matchups...</p>
      ) : games.length === 0 ? (
        <p className="gh-quiet">No matchups yet this week.</p>
      ) : (
        <ul aria-label={title} className="gh-game-list">
          {games.map((game) => {
            const top = Math.max(...game.sides.map((s) => s.points));
            return (
              <li key={game.id}>
                <button type="button" className="gh-game" onClick={() => open({ kind: "game", week, matchup: game.id })}>
                  {game.sides.map((side) => (
                    <span key={side.rosterId} className="gh-side" data-mine={side.rosterId === myRosterId || undefined}>
                      <span className="gh-name">{teamFor(side.rosterId).name}</span>
                      <span className="gh-score" data-top={(top > 0 && side.points === top) || undefined}>
                        {side.points.toFixed(2)}
                      </span>
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function IceTop() {
  const { data, error: leagueError, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const { tally, finishedWeeks, error: icesError } = useSeasonIces(data ? Math.max(1, data.nfl.week) : undefined);
  const ledger = useLedger();
  const open = useContext(DrillContext);
  const error = leagueError ?? icesError;

  const rows = useMemo(() => {
    if (!data || !tally || !finishedWeeks || ledger.status === "loading") return null;
    const pf = Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
    return iceStandings(tally, finishedWeeks, pf, ledger.status === "ok" ? ledger.ledger.summary : null)
      .filter((r) => r.total > 0)
      .slice(0, TOP);
  }, [data, tally, finishedWeeks, ledger]);

  const full = (
    <button type="button" className="gh-link" onClick={() => open({ kind: "ice-standings" })}>
      Full standings
    </button>
  );

  return (
    <Panel label="Ice standings" className="gh-standings" aside={full}>
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !rows ? (
        <p role="status">Ranking the shame...</p>
      ) : rows.length === 0 ? (
        <p className="gh-quiet">Nobody has been iced yet. Clean sheet, for now.</p>
      ) : (
        <ol aria-label="Top of the ice standings" className="gh-rows">
          {rows.map((r) => (
            <li key={r.rosterId} data-mine={r.rosterId === myRosterId || undefined}>
              <span className="gh-rank">{r.rank}</span>
              <span className="gh-name">{teamFor(r.rosterId).name}</span>
              <span className="gh-total">{r.total}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

interface GlacierHomeProps {
  ref: Ref<HTMLHeadingElement>;
}

export function GlacierHome({ ref }: GlacierHomeProps) {
  const week = useDefaultWeek();
  const { data } = useLeague();
  const ledger = useLedger();
  const open = useContext(DrillContext);

  return (
    <div className="gh">
      <section aria-label="This week" className="gh-hero">
        <div className="gh-hero-copy">
          {week !== undefined && data && (
            <span className="gh-week">
              Week {week} · {data.league.season}
            </span>
          )}
          <h1 ref={ref} tabIndex={-1} className="gh-title">
            Every zero <span>is an ice.</span>
          </h1>
          <p className="gh-lede">{lede(ledger)}</p>
          <div className="gh-ctas">
            <button type="button" className="gh-cta gh-cta-go" onClick={() => open({ kind: "videos" })}>
              Upload a chug
            </button>
            <button type="button" className="gh-cta" onClick={() => open({ kind: "ices" })}>
              See the ledger
            </button>
          </div>
        </div>
        <div className="gh-orb">
          <Image src="/brand/mascot.png" alt="The league mascot, a robot chugging a Smirnoff Ice" width={365} height={400} priority />
        </div>
      </section>
      <div className="gh-grid">
        <YourIces />
        <Chugs />
        <WeekGames week={week} />
        <IceTop />
      </div>
    </div>
  );
}
