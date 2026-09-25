"use client";

import Image from "next/image";
import { type Ref, useContext, useState } from "react";
import { createPortal } from "react-dom";

import { iceCauseText } from "@/components/videos/ice-label";
import { DueSunday, useDueLink } from "@/components/home/DueCard";
import { UploadChug } from "@/components/videos/UploadChug";
import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { TroubleTags } from "@/components/xp/TeamName";
import { chugBoard, countdown, currentWeek, myDue } from "@/lib/ices/chug-board";
import { type LedgerState, useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useTrouble } from "@/lib/ices/use-trouble";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useWeekGames } from "@/lib/league/use-week-games";
import { useProfile } from "@/lib/profile/use-profile";
import { HomeNews } from "./HomeNews";
import { Panel } from "./HomePanel";
import { Spotlight } from "./Spotlight";
import { record, useHitters } from "./use-hitters";

import "./glacier-home.css";

const PREVIEW = 3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const loadingOr = (ledger: LedgerState) =>
  ledger.status === "loading" ? (
    <p role="status">Checking the ledger...</p>
  ) : ledger.status === "error" ? (
    <p role="alert">The ledger is unavailable ({ledger.message}).</p>
  ) : null;

const deadlinesOf = (ledger: LedgerState) =>
  ledger.status === "ok" ? ledger.ledger.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) : [];

function YourIces() {
  const ledger = useLedger();
  const { data, teamFor } = useLeague();
  const { myRosterId, setEditing } = useProfile();
  const open = useContext(DrillContext);
  const [upload, setUpload] = useState(false);
  const now = useNow(deadlinesOf(ledger));
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const due = ok && myRosterId !== null ? myDue(ok, myRosterId, now) : null;
  const pill = due?.when && (
    <span className="gh-due" data-level={due.level}>
      {due.when}
    </span>
  );

  const body = () => {
    if (!ok) return loadingOr(ledger);
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
    const owed = ok.ices.filter((i) => due.iceIds.includes(i.iceId)).sort((a, b) => a.week - b.week);
    return (
      <>
        <button
          type="button"
          className="gh-owe gh-owe-open"
          aria-label={`${due.count} owed by ${teamFor(myRosterId).name}, open Ice Ledger`}
          onClick={() => open({ kind: "ices" })}
        >
          <span className="gh-owe-count">{due.count}</span>
          <span>owed by {teamFor(myRosterId).name}</span>
        </button>
        <ul aria-label="Your owed ices" className="gh-rows">
          {owed.slice(0, PREVIEW).map((ice) => (
            <li key={ice.iceId}>
              W{ice.week} · {iceCauseText(ice, data?.players ?? {})}
            </li>
          ))}
        </ul>
        {owed.length > PREVIEW && <p className="gh-quiet">and {owed.length - PREVIEW} more</p>}
        <button type="button" className="gh-button gh-button-go" onClick={() => setUpload(true)}>
          Upload your chug
        </button>
        {upload &&
          createPortal(
            // One video covers one week, so the oldest week's ices come ticked.
            <UploadChug
              ices={ok.ices}
              initialIceIds={owed.filter((i) => i.week === owed[0].week).map((i) => i.iceId)}
              onClose={() => setUpload(false)}
            />,
            document.body,
          )}
      </>
    );
  };

  return (
    <Panel id="home-ices" label="Your ices" className="gh-mine" aside={pill} all={{ kind: "ices" }}>
      {body()}
    </Panel>
  );
}

function BoardPreview({ ledger }: { ledger: LedgerState }) {
  const { teamFor } = useLeague();
  const open = useContext(DrillContext);
  const now = useNow(deadlinesOf(ledger));
  const board = ledger.status === "ok" ? chugBoard(ledger.ledger) : null;
  const owing = board?.filter((t) => t.ices.some((r) => r.ice.status === "owed")) ?? [];
  const title = !board ? "Chug Board" : owing.length ? `Chug Board · ${owing.length} owe` : "Chug Board · all paid";

  return (
    <Panel id="home-board" label="Chug Board" title={title} className="gh-board" all={{ kind: "ices" }}>
      {!board ? (
        loadingOr(ledger)
      ) : board.length === 0 ? (
        <p className="gh-quiet">Nobody owes a chug this week.</p>
      ) : (
        <ul aria-label="Chug Board" className="gh-list">
          {board.slice(0, PREVIEW).map(({ rosterId, ices }) => {
            const owed = ices.filter((r) => r.ice.status === "owed");
            const next = owed.find((r) => r.deadline !== null);
            return (
              <li key={rosterId}>
                <button type="button" className="gh-card" onClick={() => open({ kind: "team", rosterId })}>
                  <span className="gh-name">{teamFor(rosterId).name}</span>
                  <span className="gh-card-meta" data-owed={owed.length > 0 || undefined}>
                    {owed.length ? `${owed.length} owed` : "Paid up"}
                    {next && ` · ${countdown(next.deadline!, now, next.late)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

type WeekGames = ReturnType<typeof useWeekGames>;

const scoresTarget = ({ live }: WeekGames): DrillTarget => ({ kind: live ? "watch" : "scores" });

function GamesPreview({ week, games: state }: { week: number | undefined; games: WeekGames }) {
  const { data, games, teamFor, error } = state;
  const { myRosterId } = useProfile();
  const trouble = useTrouble();
  const open = useContext(DrillContext);
  const label = week === undefined ? "This week's games" : `Week ${week} games`;
  const mine = (g: { sides: { rosterId: number }[] }) => g.sides.some((s) => s.rosterId === myRosterId);
  const shown = games ? [...games].sort((a, b) => Number(mine(b)) - Number(mine(a))).slice(0, PREVIEW) : [];

  return (
    <Panel
      id="home-games"
      label={label}
      title={games ? `${label} · ${games.length}` : label}
      className="gh-games"
      all={scoresTarget(state)}
    >
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !data || !games || week === undefined ? (
        <p role="status">Loading the matchups...</p>
      ) : games.length === 0 ? (
        <p className="gh-quiet">No matchups yet this week.</p>
      ) : (
        <ul aria-label={label} className="gh-list">
          {shown.map((game) => {
            const top = Math.max(...game.sides.map((s) => s.points));
            return (
              <li key={game.id}>
                <button type="button" className="gh-game" onClick={() => open({ kind: "game", week, matchup: game.id })}>
                  {game.sides.map((side) => (
                    <span
                      key={side.rosterId}
                      className="gh-side"
                      data-mine={side.rosterId === myRosterId || undefined}
                      data-trouble={trouble.of(side.rosterId).join(" ") || undefined}
                    >
                      <span className="gh-name">{teamFor(side.rosterId).name}</span>
                      <TroubleTags trouble={trouble.of(side.rosterId)} />
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

// The top 3, your team and the bottom 2, so both races fit in one short list.
function StandingsPreview() {
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const trouble = useTrouble();
  const open = useContext(DrillContext);
  const rows = data ? sortStandings(data.rosters) : null;
  const shown = rows
    ?.map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => r.rank <= 3 || r.rank > rows.length - 2 || r.rosterId === myRosterId);

  return (
    <Panel id="home-standings" label="Standings" className="gh-standings" all={{ kind: "standings" }}>
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !shown ? (
        <p role="status">Loading the standings...</p>
      ) : (
        <ul aria-label="Standings snapshot" className="gh-list">
          {shown.map((r, i) => (
            <li
              key={r.rosterId}
              data-mine={r.rosterId === myRosterId || undefined}
              data-trouble={trouble.of(r.rosterId).join(" ") || undefined}
              data-gap={(i > 0 && shown[i - 1].rank !== r.rank - 1) || undefined}
            >
              <button type="button" className="gh-card gh-card-row" onClick={() => open({ kind: "team", rosterId: r.rosterId })}>
                <span className="gh-rank">{r.rank}</span>
                <span className="gh-name">{teamFor(r.rosterId).name}</span>
                <TroubleTags trouble={trouble.of(r.rosterId)} />
                <span className="gh-total">{record(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function QuickHitters({ week, games, phone }: { week: number | undefined; games: WeekGames; phone: boolean }) {
  const hitters = useHitters(week, games);
  if (phone) {
    const all = hitters && [...hitters.ices, ...hitters.league, ...hitters.chugs];
    return <Spotlight id="home-hitters" label="Quick hitters" facts={all} />;
  }
  return (
    <section aria-label="Quick hitters" className="gh-hitters">
      <Spotlight id="home-hitters-ices" label="Ice report" facts={hitters?.ices ?? null} />
      <Spotlight id="home-hitters-league" label="League" facts={hitters?.league ?? null} />
      <Spotlight id="home-hitters-chugs" label="Chugs" facts={hitters?.chugs ?? null} />
    </section>
  );
}

function lede(ledger: LedgerState): string {
  const deadline = "Chug by Sunday 1:00 PM ET, on camera.";
  if (ledger.status !== "ok") return deadline;
  const week = currentWeek(ledger.ledger);
  if (!week) return "No ices on the board yet. Start a zero and that changes.";
  const n = ledger.ledger.ices.filter((i) => i.week === week && i.reason !== "late").length;
  if (!n) return `Week ${week} left no ices on the board.`;
  return `Week ${week} left ${plural(n, "ice")}. ${deadline}`;
}

function DuePanel() {
  return (
    <Panel id="home-due" label="Due Sunday" className="gh-due-card" all={useDueLink()} more="See ledger">
      <DueSunday />
    </Panel>
  );
}

interface GlacierHomeProps {
  ref?: Ref<HTMLHeadingElement>;
  // The phone shell's bar holds the page's h1, so its hero title is an h2.
  phone?: boolean;
}

export function GlacierHome({ ref, phone = false }: GlacierHomeProps) {
  const week = useDefaultWeek();
  const { data } = useLeague();
  const ledger = useLedger();
  const games = useWeekGames(week);
  const open = useContext(DrillContext);
  const Title = phone ? "h2" : "h1";

  return (
    <div className="gh">
      <section aria-label="This week" className="gh-hero">
        <div className="gh-hero-copy">
          {week !== undefined && data && (
            <span className="gh-week">
              Week {week} · {data.league.season}
            </span>
          )}
          <Title ref={ref} tabIndex={-1} className="gh-title">
            Every zero <span>is an ice.</span>
          </Title>
          <p className="gh-lede">{lede(ledger)}</p>
        </div>
        {!phone && (
          <div className="gh-ctas">
            <button type="button" className="gh-cta gh-cta-go" onClick={() => open({ kind: "videos" })}>
              Upload a chug
            </button>
            <button type="button" className="gh-cta" onClick={() => open({ kind: "ices" })}>
              See the ledger
            </button>
          </div>
        )}
        <Image src="/brand/mascot.png" alt="The league mascot, a robot chugging a Smirnoff Ice" width={146} height={160} priority className="gh-mascot" />
      </section>
      <DuePanel />
      <QuickHitters week={week} games={games} phone={phone} />
      <div className="gh-grid">
        <YourIces />
        <HomeNews />
        <StandingsPreview />
        <GamesPreview week={week} games={games} />
        <BoardPreview ledger={ledger} />
      </div>
    </div>
  );
}
