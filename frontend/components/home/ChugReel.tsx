"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { BackArrowIcon, ForwardArrowIcon, MediaPlayerIcon } from "@/components/xp/icons";
import type { Video } from "@/lib/api/videos";
import { useLeague } from "@/lib/league/use-league";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { VideosState } from "@/lib/videos/use-videos";

import "./chugs.css";

export const REEL_MS = 5000;

interface ChugReelProps {
  week: number;
  videos: VideosState;
  onVideoError: () => void;
}

export function ChugReel({ week, videos, onVideoError }: ChugReelProps) {
  const { teamFor } = useLeague();
  const reduced = useReducedMotion();
  const [at, setAt] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const clips =
    videos.status === "ok"
      ? videos.videos.filter((v) => v.week >= week - 1).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
  const paused = hovered || focused || reduced || clips.length < 2;
  const label = (v: Video) => `${v.rosterIds.map((r) => teamFor(r).name).join(" & ")} · Week ${v.week}`;
  const shown = clips[at % Math.max(1, clips.length)];
  const open = clips.find((v) => v.mediaId === playing);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setAt((i) => i + 1), REEL_MS);
    return () => clearInterval(id);
  }, [paused]);

  const step = (by: number) => setAt((i) => (i + by + clips.length) % clips.length);

  const thumb = (v: Video, autoPlay: boolean) => (
    <button type="button" className="chug-reel-clip" aria-label={`Watch ${label(v)} chug`} onClick={() => setPlaying(v.mediaId)}>
      {/* muted is the only way a browser lets autoplay start. */}
      <video
        key={v.url}
        src={`${v.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        loop={autoPlay}
        autoPlay={autoPlay}
        tabIndex={-1}
        aria-hidden
        onError={onVideoError}
      />
      <MediaPlayerIcon width={24} height={24} className="chug-thumb-play" />
      <span className="chug-reel-caption">{label(v)}</span>
    </button>
  );

  return (
    <section
      className="xp-group"
      aria-roledescription="carousel"
      aria-labelledby="chug-reel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <h3 id="chug-reel" className="xp-group-title">
        Chug Reel
      </h3>
      {videos.status === "loading" ? (
        <p role="status">Rewinding the chug tapes...</p>
      ) : videos.status === "error" ? (
        <p role="alert">Chug videos unavailable ({videos.message}).</p>
      ) : !shown ? (
        <p className="italic">No chugs yet this week. Somebody&apos;s stalling.</p>
      ) : reduced ? (
        <ul className="chug-reel-strip" aria-label="Recent chugs">
          {clips.map((v) => (
            <li key={v.mediaId}>{thumb(v, false)}</li>
          ))}
        </ul>
      ) : (
        <div className="chug-reel-stage">
          <button type="button" className="xp-button chug-reel-step" aria-label="Previous chug" disabled={clips.length < 2} onClick={() => step(-1)}>
            <BackArrowIcon width={20} height={20} />
          </button>
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${(at % clips.length) + 1} of ${clips.length}`}
            aria-live={paused ? "polite" : "off"}
            className="chug-reel-slide"
          >
            {thumb(shown, true)}
          </div>
          <span className="chug-reel-count" aria-hidden>
            {(at % clips.length) + 1} / {clips.length}
          </span>
          <button type="button" className="xp-button chug-reel-step" aria-label="Next chug" disabled={clips.length < 2} onClick={() => step(1)}>
            <ForwardArrowIcon width={20} height={20} />
          </button>
        </div>
      )}
      {open &&
        createPortal(<ChugPlayer video={open} label={label(open)} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </section>
  );
}
