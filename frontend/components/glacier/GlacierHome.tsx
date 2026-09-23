"use client";

import Image from "next/image";
import { type ReactNode, type Ref, type UIEvent, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { chugTime } from "@/components/videos/ChugTime";
import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChug } from "@/components/videos/UploadChug";
import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { TroubleTags } from "@/components/xp/TeamName";
import { chugBoard, countdown, currentWeek, myDue } from "@/lib/ices/chug-board";
import { chuggerRankings, chugsFrom } from "@/lib/ices/chug-rankings";
import { iceStandings } from "@/lib/ices/standings";
import { type LedgerState, useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useTrouble } from "@/lib/ices/use-trouble";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useWeekGames } from "@/lib/league/use-week-games";
import { useProfile } from "@/lib/profile/use-profile";
import { Crystal, Icicles, PANEL_ICICLES } from "./Frost";

import "./glacier-home.css";

const PREVIEW = 3;

const SECTIONS = [
  { id: "home-ices", chip: "Your ices" },
  { id: "home-games", chip: "Games" },
  { id: "home-standings", chip: "Ice standings" },
  { id: "home-board", chip: "Chug Board" },
  { id: "home-rankings", chip: "Chug rankings" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

interface PanelProps {
  id: string;
  label: string;
  title?: string;
  all?: DrillTarget;
  aside?: ReactNode;
  className: string;
  children: ReactNode;
}

function Panel({ id, label, title = label, all, aside, className, children }: PanelProps) {
  const open = useContext(DrillContext);
  return (
    <section id={id} aria-label={label} className={`glacier-panel gh-panel ${className}`}>
      <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
      <Crystal />
      <div className="gh-head">
        <h2 tabIndex={-1}>{title}</h2>
        {aside}
        {all && (
          <button type="button" className="gh-link" aria-label={`See all: ${label}`} onClick={() => open(all)}>
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// On a phone the list scrolls sideways; the dots say where you are in it.
function Carousel({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [at, setAt] = useState(0);
  const onScroll = (e: UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    const room = el.scrollWidth - el.clientWidth;
    setAt(room > 0 ? Math.round((el.scrollLeft / room) * (count - 1)) : 0);
  };
  return (
    <>
      <ul aria-label={label} className="gh-carousel" onScroll={onScroll}>
        {children}
      </ul>
      {count > 1 && (
        <p className="gh-dots" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} data-on={i === at || undefined} />
          ))}
        </p>
      )}
    </>
  );
}

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
        <p className="gh-owe">
          <span className="gh-owe-count">{due.count}</span>
          <span>owed by {teamFor(myRosterId).name}</span>
        </p>
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
        <Carousel label="Chug Board" count={Math.min(PREVIEW, board.length)}>
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
        </Carousel>
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
        <Carousel label={label} count={shown.length}>
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
        </Carousel>
      )}
    </Panel>
  );
}

function useIceTop() {
  const { data, error: leagueError } = useLeague();
  const { tally, finishedWeeks, error: icesError } = useSeasonIces(data ? Math.max(1, data.nfl.week) : undefined);
  const ledger = useLedger();
  const rows = useMemo(() => {
    if (!data || !tally || !finishedWeeks || ledger.status === "loading") return null;
    const pf = Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
    return iceStandings(tally, finishedWeeks, pf, ledger.status === "ok" ? ledger.ledger.summary : null).filter((r) => r.total > 0);
  }, [data, tally, finishedWeeks, ledger]);
  return { rows, error: leagueError ?? icesError };
}

function StandingsPreview({ rows, error }: ReturnType<typeof useIceTop>) {
  const { teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const trouble = useTrouble();
  const open = useContext(DrillContext);
  const shown = rows?.slice(0, PREVIEW) ?? [];

  return (
    <Panel
      id="home-standings"
      label="Ice standings"
      title={rows ? `Ice standings · ${rows.length} iced` : "Ice standings"}
      className="gh-standings"
      all={{ kind: "ice-standings" }}
    >
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !rows ? (
        <p role="status">Ranking the shame...</p>
      ) : rows.length === 0 ? (
        <p className="gh-quiet">Nobody has been iced yet. Clean sheet, for now.</p>
      ) : (
        <Carousel label="Top of the ice standings" count={shown.length}>
          {shown.map((r) => (
            <li key={r.rosterId} data-mine={r.rosterId === myRosterId || undefined} data-trouble={trouble.of(r.rosterId).join(" ") || undefined}>
              <button type="button" className="gh-card gh-card-row" onClick={() => open({ kind: "team", rosterId: r.rosterId })}>
                <span className="gh-rank">{r.rank}</span>
                <span className="gh-name">{teamFor(r.rosterId).name}</span>
                <TroubleTags trouble={trouble.of(r.rosterId)} />
                <span className="gh-total">{r.total}</span>
              </button>
            </li>
          ))}
        </Carousel>
      )}
    </Panel>
  );
}

function useFastest(ledger: LedgerState) {
  return useMemo(() => (ledger.status === "ok" ? chuggerRankings(chugsFrom(ledger.ledger.ices)) : null), [ledger]);
}

function RankingsPreview({ ledger }: { ledger: LedgerState }) {
  const { teamFor } = useLeague();
  const open = useContext(DrillContext);
  const rows = useFastest(ledger);
  const shown = rows?.slice(0, PREVIEW) ?? [];

  return (
    <Panel
      id="home-rankings"
      label="Chug rankings"
      title={rows ? `Chug rankings · ${rows.length} timed` : "Chug rankings"}
      className="gh-rankings"
      all={{ kind: "chug-rankings" }}
    >
      {!rows ? (
        loadingOr(ledger)
      ) : rows.length === 0 ? (
        <p className="gh-quiet">No chug has been timed yet.</p>
      ) : (
        <Carousel label="Fastest chuggers" count={shown.length}>
          {shown.map((r) => (
            <li key={r.key}>
              <button type="button" className="gh-card gh-card-row" onClick={() => open({ kind: "team", rosterId: r.rosterId })}>
                <span className="gh-rank">{r.rank}</span>
                <span className="gh-name">{r.name ?? teamFor(r.rosterId).name}</span>
                <span className="gh-total">{chugTime(r.pr)}</span>
              </button>
            </li>
          ))}
        </Carousel>
      )}
    </Panel>
  );
}

interface StripProps {
  week: number | undefined;
  ledger: LedgerState;
  games: WeekGames;
  standings: ReturnType<typeof useIceTop>;
}

function StatusStrip({ week, ledger, games, standings }: StripProps) {
  const { teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const open = useContext(DrillContext);
  const now = useNow(deadlinesOf(ledger));
  const fastest = useFastest(ledger)?.[0];
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const due = ok && myDue(ok, myRosterId, now);
  const deadlineUtc = ok?.weeks.find((w) => w.week === currentWeek(ok))?.deadlineUtc;
  const leader = standings.rows?.[0];
  const top = games.games && Math.max(0, ...games.games.flatMap((g) => g.sides.map((s) => s.points)));

  const tiles: { label: string; value: string; sub: string; to: DrillTarget; alert?: boolean }[] = [
    {
      label: "Your ices",
      value: myRosterId === null ? "No team" : !ok ? "..." : due ? `${due.count} owed` : "Square",
      sub: myRosterId === null ? "Claim yours" : (due?.when ?? "Nothing owed"),
      to: { kind: "ices" },
      alert: Boolean(due),
    },
    {
      label: "This week",
      value: week === undefined ? "..." : `Week ${week}`,
      sub: deadlineUtc ? `Chugs ${countdown(Date.parse(deadlineUtc), now, 0)}` : "No chugs due",
      to: { kind: "week", week: week ?? 1 },
    },
    {
      label: "Scores",
      value: !games.games ? "..." : games.live ? (games.liveGames ? `${games.liveGames} live` : "None live") : "Final",
      sub: top ? `High score ${top.toFixed(2)}` : "No points yet",
      to: scoresTarget(games),
    },
    {
      label: "Most ices",
      value: leader ? teamFor(leader.rosterId).name : standings.rows ? "Nobody" : "...",
      sub: leader ? plural(leader.total, "ice") : "Clean sheet",
      to: { kind: "ice-standings" },
    },
    {
      label: "Fastest chug",
      value: fastest ? (fastest.name ?? teamFor(fastest.rosterId).name) : "Nobody",
      sub: fastest ? chugTime(fastest.pr) : "No times yet",
      to: { kind: "chug-rankings" },
    },
  ];

  return (
    <section aria-label="At a glance" className="gh-strip">
      <ul>
        {tiles.map((t) => (
          <li key={t.label}>
            <button type="button" className="gh-tile" data-alert={t.alert || undefined} onClick={() => open(t.to)}>
              <span className="gh-tile-label">{t.label}</span>
              <span className="gh-tile-value">{t.value}</span>
              <span className="gh-tile-sub">{t.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function jump(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
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
  const standings = useIceTop();
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
      <StatusStrip week={week} ledger={ledger} games={games} standings={standings} />
      <nav aria-label="Jump to a section" className="gh-jump">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className="gh-chip" onClick={() => jump(s.id)}>
            {s.chip}
          </button>
        ))}
      </nav>
      <div className="gh-grid">
        <YourIces />
        <GamesPreview week={week} games={games} />
        <StandingsPreview {...standings} />
        <BoardPreview ledger={ledger} />
        <RankingsPreview ledger={ledger} />
      </div>
    </div>
  );
}
