"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { DrillLink } from "@/components/views/drill-link";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import { chugBoard, countdown, currentWeek, urgency } from "@/lib/ices/chug-board";
import { useNow } from "@/lib/ices/use-now";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { type VideosState, videoFor } from "@/lib/videos/use-videos";

interface Playing {
  video: Video;
  label: string;
}

function usePlayer(onVideoError: () => void) {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const player =
    playing &&
    createPortal(
      <ChugPlayer video={playing.video} label={playing.label} onError={onVideoError} onClose={() => setPlaying(null)} />,
      document.body,
    );
  return { play: setPlaying, player };
}

interface ChugBoardCardsProps {
  ledger: Ledger;
  videos: Video[];
  onVideoError: () => void;
}

// One row per team with ices this week or last: what it owes and when, or its chug.
export function ChugBoardCards({ ledger, videos, onVideoError }: ChugBoardCardsProps) {
  const { teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const { play, player } = usePlayer(onVideoError);
  const board = chugBoard(ledger);
  const now = useNow(board.flatMap((t) => t.ices.flatMap((r) => (r.ice.status === "owed" && r.deadline ? [r.deadline] : []))));

  return (
    <section aria-labelledby="m-chug-board" className="m-section">
      <h2 id="m-chug-board" className="m-section-title">
        Chug Board
      </h2>
      {board.length === 0 ? (
        <p className="m-empty">Nobody owes a chug this week.</p>
      ) : (
        <ul aria-label="Chug Board" className="m-card m-rows">
          {board.map(({ rosterId, ices }) => {
            const name = teamFor(rosterId).name;
            const owed = ices.filter((r) => r.ice.status === "owed");
            const video = ices.map((r) => videoFor(videos, r.ice)).find(Boolean);
            const first = owed[0];
            return (
              <li key={rosterId} className="m-row">
                <DrillLink to={{ kind: "team", rosterId }}>
                  <TeamName name={name} iced={owed.length > 0} ices={owed.length} isMine={rosterId === myRosterId} />
                </DrillLink>
                {first ? (
                  <span className="m-due" data-level={first.deadline === null ? "due" : urgency(first.deadline, now)}>
                    {first.deadline === null ? "owed" : countdown(first.deadline, now, first.late)}
                  </span>
                ) : video ? (
                  <button type="button" className="m-play" onClick={() => play({ video, label: `${name} · Week ${video.week}` })}>
                    <MediaPlayerIcon width={20} height={20} />
                    Watch
                  </button>
                ) : (
                  <span className="m-done">Chugged</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {player}
    </section>
  );
}

interface ChugReelRowProps {
  ledger: Ledger;
  videos: VideosState;
  onVideoError: () => void;
}

// This week's and last week's chugs, newest first, as a swipeable row.
export function ChugReelRow({ ledger, videos, onVideoError }: ChugReelRowProps) {
  const { teamFor } = useLeague();
  const { play, player } = usePlayer(onVideoError);
  const since = currentWeek(ledger) - 1;
  const clips =
    videos.status === "ok" ? videos.videos.filter((v) => v.week >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const label = (v: Video) => `${v.rosterIds.map((r) => teamFor(r).name).join(" & ")} · Week ${v.week}`;

  return (
    <section aria-labelledby="m-chug-reel" className="m-section">
      <h2 id="m-chug-reel" className="m-section-title">
        Chug Reel
      </h2>
      {videos.status === "loading" ? (
        <p role="status">Rewinding the chug tapes...</p>
      ) : videos.status === "error" ? (
        <p role="alert">Chug videos unavailable ({videos.message}).</p>
      ) : clips.length === 0 ? (
        <p className="m-empty">No chugs yet this week. Somebody&apos;s stalling.</p>
      ) : (
        <ul aria-label="Recent chugs" className="m-hscroll">
          {clips.map((v) => (
            <li key={v.mediaId}>
              <button type="button" className="m-clip" aria-label={`Watch ${label(v)} chug`} onClick={() => play({ video: v, label: label(v) })}>
                {/* Safari paints nothing for preload="metadata" until a seek; the fragment asks for the first frame. */}
                <video src={`${v.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden onError={onVideoError} />
                <MediaPlayerIcon width={32} height={32} className="m-clip-play" />
                <span className="m-clip-caption">{label(v)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {player}
    </section>
  );
}
