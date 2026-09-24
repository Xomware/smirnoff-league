"use client";

import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LINE_ICONS } from "@/components/glacier/GlacierPhone";
import { DrillContext } from "@/components/views/drill-link";
import { useAwards } from "@/lib/awards/use-awards";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useWeekGames } from "@/lib/league/use-week-games";
import { type TickerItem, tickerItems } from "@/lib/ticker/items";
import { useTickerHidden } from "@/lib/ticker/prefs";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useVideos } from "@/lib/videos/use-videos";
import { useWriteups } from "@/lib/writeups/use-writeups";

import "./ticker.css";

const PX_PER_SECOND = 60;

const Glyph = ({ d }: { d: string }) => (
  <svg className="tk-glyph" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Item({ item }: { item: TickerItem }) {
  const open = useContext(DrillContext);
  return (
    <button type="button" className="tk-item" onClick={() => open(item.to)}>
      <span className="tk-tag">{item.tag}</span> {item.text}
    </button>
  );
}

function Copy({ items, hidden }: { items: TickerItem[]; hidden?: boolean }) {
  return (
    <ul className="tk-copy" aria-hidden={hidden || undefined} inert={hidden}>
      {items.map((item, i) => (
        <li key={item.id} data-tone={item.tone}>
          <Item item={item} />
          <Glyph d={i % 2 ? LINE_ICONS.games : LINE_ICONS.ices} />
        </li>
      ))}
    </ul>
  );
}

const Chevron = ({ d }: { d: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface TickerBarProps {
  // Null until every source has loaded, so the first loop is the whole list.
  items: TickerItem[] | null;
  xp?: boolean;
  dock?: boolean;
}

export function TickerBar({ items, xp = false, dock = false }: TickerBarProps) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(items ?? []);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [at, setAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  // A new list lands at the loop's seam, where the track is back at 0, so the
  // bar never jumps mid-scroll. An empty or stepped bar has no seam to wait for.
  if (items && shown !== items && (still || !shown.length)) setShown(items);

  useLayoutEffect(() => {
    const width = track.current?.firstElementChild?.scrollWidth ?? 0;
    setSeconds(Math.max(10, width / PX_PER_SECOND));
  }, [shown]);

  const count = shown.length;
  const step = (by: number) => setAt((i) => (i + by + count) % count);
  const index = at % Math.max(count, 1);
  const current = shown[index];

  return (
    <section
      aria-label="League ticker"
      className="tk"
      data-xp={xp || dock || undefined}
      data-dock={dock || undefined}
      data-paused={paused || touched || undefined}
      onTouchStart={() => setTouched(true)}
      onTouchEnd={() => setTouched(false)}
      onTouchCancel={() => setTouched(false)}
    >
      {!count ? (
        <p className="tk-quiet" role="status">
          {items ? "Nothing on the wire yet." : "Checking the wire..."}
        </p>
      ) : still ? (
        <div className="tk-step" aria-live="polite">
          <span data-tone={current.tone}>
            <Item item={current} />
          </span>
          <span className="tk-count">
            {index + 1} of {count}
          </span>
        </div>
      ) : (
        <div className="tk-view">
          <div
            ref={track}
            className="tk-track"
            style={{ animationDuration: `${seconds}s` }}
            onAnimationIteration={() => items && setShown(items)}
          >
            <Copy items={shown} />
            <Copy items={shown} hidden />
          </div>
        </div>
      )}
      {!count ? null : still ? (
        <span className="tk-controls">
          <button type="button" className="tk-control" aria-label="Previous item" disabled={count < 2} onClick={() => step(-1)}>
            <Chevron d="M10 3 5 8l5 5" />
          </button>
          <button type="button" className="tk-control" aria-label="Next item" disabled={count < 2} onClick={() => step(1)}>
            <Chevron d="M6 3l5 5-5 5" />
          </button>
        </span>
      ) : (
        <button type="button" className="tk-control" aria-label={paused ? "Play ticker" : "Pause ticker"} onClick={() => setPaused(!paused)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d={paused ? "M4 2.5v11l9-5.5z" : "M4 2.5h3v11H4zM9 2.5h3v11H9z"} />
          </svg>
        </button>
      )}
    </section>
  );
}

function LiveTicker({ xp, dock }: TickerProps) {
  const week = useDefaultWeek();
  const { games, current, live, liveGames } = useWeekGames(week);
  const { data, teamFor } = useLeague();
  const ledger = useLedger();
  const videos = useVideos().state;
  const writeups = useWriteups().state;
  const awards = useAwards();
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const now = useNow(ok?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);

  const ready =
    !!data &&
    games !== null &&
    [ledger, videos, writeups].every((s) => s.status !== "loading") &&
    (awards.weeks !== null || awards.error !== null);
  const items = useMemo(
    () =>
      ready &&
      tickerItems({
        week,
        current,
        games,
        live: live && liveGames > 0,
        ledger: ok,
        players: data?.players ?? {},
        videos: videos.status === "ok" ? videos.videos : [],
        writeups: writeups.status === "ok" ? writeups.writeups : [],
        standings: data ? sortStandings(data.rosters) : null,
        awards: awards.weeks?.at(-1) ?? null,
        teamName: (r) => teamFor(r).name,
        now,
      }),
    [ready, week, current, games, live, liveGames, ok, videos, writeups, awards.weeks, data, teamFor, now],
  );
  return <TickerBar items={items || null} xp={xp} dock={dock} />;
}

interface TickerProps {
  xp?: boolean;
  /** Pinned above the XP desktop's taskbar. */
  dock?: boolean;
}

/** The league ticker, unless it's switched off in Settings or the XP tray. */
export function Ticker({ xp, dock }: TickerProps) {
  const hidden = useTickerHidden();
  return hidden ? null : <LiveTicker xp={xp} dock={dock} />;
}
