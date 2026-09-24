"use client";

import Image from "next/image";
import { type CSSProperties, type KeyboardEvent, useContext, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DrillContext } from "@/components/views/drill-link";
import { BackArrowIcon, CloseGlyph, ForwardArrowIcon, MediaPlayerIcon } from "@/components/xp/icons";
import type { Video } from "@/lib/api/videos";
import { useLedger } from "@/lib/ices/use-ledger";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useVideos } from "@/lib/videos/use-videos";
import { fitVisualViewport } from "@/lib/visual-viewport";
import { ChugPlayer } from "./ChugPlayer";
import { chugTime } from "./ChugTime";
import { iceCauseText } from "./ice-label";

import "./chug-reel-popup.css";

export const REEL_POPUP_MS = 4000;
// Long enough for the sign-in ICE.EXE box, which waits on the season's ices, to open first.
export const QUIET_MS = 1500;
// The Glacier phone menu stays mounted while closed, inert, so only a live modal counts.
const busy = () =>
  !!document.querySelector(".theme-transition") || [...document.querySelectorAll('[aria-modal="true"]')].some((m) => !m.closest("[inert]"));
const SWIPE_PX = 40;
// Cards this far from the current one hold a <video> for their poster frame; the rest wait.
const POSTER_REACH = 2;

const seenKey = (sub: string, week: number) => `smirnoff.chugReel:${sub}:w${week}`;

// Storage can be blocked or corrupt. Then the in-memory list stops a repeat
// this visit, and the reel may show once more next visit.
function loadSeen(sub: string, week: number): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(seenKey(sub, week)) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveSeen(sub: string, week: number, ids: string[]) {
  try {
    localStorage.setItem(seenKey(sub, week), JSON.stringify(ids));
  } catch {
    // The in-memory list covers this visit.
  }
}

// Calls onQuiet once no modal or theme transition has been on screen for QUIET_MS.
function useWhenQuiet(active: boolean, onQuiet: () => void) {
  const fire = useEffectEvent(onQuiet);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (busy()) {
        clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) {
        timer = setTimeout(fire, QUIET_MS);
      }
    };
    check();
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true, subtree: true, attributeFilter: ["inert"] });
    return () => {
      watch.disconnect();
      clearTimeout(timer);
    };
  }, [active]);
}

interface Shown {
  week: number;
  fresh: string[];
  returning: boolean;
}

export function ChugReelPopup() {
  const { state, onVideoError } = useVideos();
  const ledger = useLedger();
  const { data, teamFor } = useLeague();
  const sub = useProfile().me?.sub;
  const drill = useContext(DrillContext);
  const reduced = useReducedMotion();
  const headingId = useId();
  const box = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [at, setAt] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const videos = state.status === "ok" ? state.videos : [];
  const week = shown?.week ?? Math.max(0, ...videos.map((v) => v.week));
  const clips = videos.filter((v) => v.week === week);
  const stored = sub && !shown && clips.length ? loadSeen(sub, week) : [];
  const unseen = sub && !shown ? clips.filter((v) => !seen.includes(v.mediaId) && !stored.includes(v.mediaId)) : [];

  useWhenQuiet(unseen.length > 0, () => {
    if (!sub) return;
    const ids = clips.map((v) => v.mediaId);
    saveSeen(sub, week, [...new Set([...stored, ...ids])]);
    setSeen((s) => [...s, ...ids]);
    setShown({ week, fresh: unseen.map((v) => v.mediaId), returning: unseen.length < clips.length });
    setAt(0);
    setHovered(false);
    setFocused(false);
  });

  const open = shown !== null;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("button")?.focus();
    return () => opener?.focus();
  }, [open]);

  const count = clips.length;
  const paused = hovered || focused || touching || reduced || playing !== null || count < 2;
  useEffect(() => {
    if (!open || paused) return;
    const id = setInterval(() => setAt((i) => (i + 1) % count), REEL_POPUP_MS);
    return () => clearInterval(id);
  }, [open, paused, count]);

  if (!shown) return null;

  const isFresh = (v: Video) => shown.fresh.includes(v.mediaId);
  const reel = [...clips].sort((a, b) => Number(isFresh(b)) - Number(isFresh(a)) || b.createdAt.localeCompare(a.createdAt));
  const current = Math.min(at, reel.length - 1);
  const ices = new Map(ledger.status === "ok" ? ledger.ledger.ices.map((i) => [i.iceId, i] as const) : []);
  const teams = (v: Video) => v.rosterIds.map((r) => teamFor(r).name).join(" & ");
  const label = (v: Video) => `${teams(v)} · Week ${v.week}`;
  const video = reel.find((v) => v.mediaId === playing);
  const step = (by: number) => setAt((current + by + reel.length) % reel.length);
  const close = () => setShown(null);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") return step(e.key === "ArrowLeft" ? -1 : 1);
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll("button") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  const card = (v: Video, i: number) => {
    const covered = v.iceIds.flatMap((id) => ices.get(id) ?? []);
    const seconds = covered.find((c) => c.chugSeconds !== undefined)?.chugSeconds;
    const avatar = teamFor(v.rosterIds[0] ?? 0).avatarUrl;
    const cause = covered.map((c) => iceCauseText(c, data?.players ?? {})).join(", ");
    const isNew = shown.returning && isFresh(v);
    const name = [`Watch ${teams(v)} chug`, isNew && "new", cause && `paid ${cause}`, seconds !== undefined && chugTime(seconds)];
    return (
      <div key={v.mediaId} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${reel.length}`} className="reel-slide" data-current={i === current || undefined}>
        <button
          type="button"
          className="reel-card"
          aria-label={name.filter(Boolean).join(", ")}
          onFocus={() => setAt(i)}
          onClick={(e) => {
            // Safari doesn't focus a clicked button, and the player hands focus back to whatever had it.
            e.currentTarget.focus();
            setPlaying(v.mediaId);
          }}
        >
          <span className="reel-poster">
            {Math.abs(i - current) <= POSTER_REACH && (
              <video src={`${v.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden onError={onVideoError} />
            )}
            <MediaPlayerIcon width={32} height={32} className="reel-play" />
            {isNew && <span className="reel-new">New</span>}
          </span>
          <span className="reel-meta">
            <span className="reel-team">
              <span className="xp-avatar reel-avatar" aria-hidden>
                {avatar ? <Image src={avatar} alt="" width={24} height={24} /> : teams(v).charAt(0).toUpperCase()}
              </span>
              <span className="reel-team-name">{teams(v)}</span>
            </span>
            {cause && (
              <span className="reel-fact">
                <span className="reel-fact-label">Paid</span>
                <span>{cause}</span>
              </span>
            )}
            {seconds !== undefined && (
              <span className="reel-fact">
                <span className="reel-fact-label">Time</span>
                <span>{chugTime(seconds)}</span>
              </span>
            )}
          </span>
        </button>
      </div>
    );
  };

  const fresh = shown.fresh.length;
  return (
    <>
      {createPortal(
        <div ref={fitVisualViewport} className="xp-backdrop reel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
          <div ref={box} role="dialog" aria-modal="true" aria-labelledby={headingId} className="xp-dialog reel-popup" onKeyDown={onKeyDown}>
            <div className="xp-dialog-title reel-bar">
              <MediaPlayerIcon className="shrink-0" />
              <span className="reel-exe">Chug Reel.exe</span>
              <button type="button" className="xp-control xp-control-close reel-x" aria-label="Close" onClick={close}>
                <CloseGlyph />
              </button>
            </div>
            <header className="reel-head">
              <h2 id={headingId}>Week {shown.week} chugs</h2>
              <p>
                {reel.length} {reel.length === 1 ? "chug" : "chugs"}
                {shown.returning && ` · ${fresh} new`}
              </p>
            </header>
            <section
              className="reel-stage"
              aria-roledescription="carousel"
              aria-label="Chugs"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
              onTouchStart={(e) => {
                touchX.current = e.touches[0].clientX;
                setTouching(true);
              }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
                if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
                setTouching(false);
              }}
            >
              {/* Focusing an off-screen card scrolls the clip box; the transform does the moving. */}
              <div className="reel-viewport" onScroll={(e) => (e.currentTarget.scrollLeft = 0)}>
                <div className="reel-track" style={{ "--at": current } as CSSProperties}>
                  {reel.map(card)}
                </div>
              </div>
              {reel.length > 1 && (
                <div className="reel-controls">
                  <button type="button" className="xp-button reel-step" aria-label="Previous chug" onClick={() => step(-1)}>
                    <BackArrowIcon width={20} height={20} />
                  </button>
                  <div className="reel-dots">
                    {reel.map((v, i) => (
                      <button
                        key={v.mediaId}
                        type="button"
                        className="reel-dot"
                        aria-label={`Chug ${i + 1}`}
                        aria-current={i === current || undefined}
                        onClick={() => setAt(i)}
                      />
                    ))}
                  </div>
                  <button type="button" className="xp-button reel-step" aria-label="Next chug" onClick={() => step(1)}>
                    <ForwardArrowIcon width={20} height={20} />
                  </button>
                </div>
              )}
              <p className="reel-count" aria-live={paused ? "polite" : "off"}>
                {current + 1} of {reel.length}
              </p>
            </section>
            <div className="reel-footer">
              <button
                type="button"
                className="xp-button"
                onClick={() => {
                  close();
                  drill({ kind: "videos" });
                }}
              >
                View all chug videos
              </button>
              <button type="button" className="xp-button reel-continue" onClick={close}>
                Continue to site
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {video && createPortal(<ChugPlayer video={video} label={label(video)} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </>
  );
}
