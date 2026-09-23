"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { DrillLink } from "@/components/views/drill-link";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import { type BoardIce, chugBoard, countdown } from "@/lib/ices/chug-board";
import { useNow } from "@/lib/ices/use-now";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { videoFor } from "@/lib/videos/use-videos";

import "./chugs.css";

interface ChugBoardProps {
  ledger: Ledger;
  videos: Video[];
  onVideoError: () => void;
}

export function ChugBoard({ ledger, videos, onVideoError }: ChugBoardProps) {
  const { data, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const [upload, setUpload] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ mediaId: string; label: string } | null>(null);
  const board = chugBoard(ledger);
  const playingVideo = playing && videos.find((v) => v.mediaId === playing.mediaId);
  const now = useNow(board.flatMap((t) => t.ices.flatMap((r) => (r.ice.status === "owed" && r.deadline ? [r.deadline] : []))));

  const cell = ({ ice, deadline, late }: BoardIce) => {
    const team = teamFor(ice.rosterId).name;
    const label = `${team} · Week ${ice.week}`;
    const cause = iceCauseText(ice, data?.players ?? {});
    if (ice.status === "owed") {
      return (
        <li key={ice.iceId} className="chug-owed">
          <span className="chug-week">W{ice.week}</span>
          <span className="chug-cause">{cause}</span>
          <span className="chug-countdown">{deadline === null ? "owed" : countdown(deadline, now, late)}</span>
          {ice.rosterId === myRosterId && <UploadChugButton onClick={() => setUpload(ice.iceId)} />}
        </li>
      );
    }
    const video = videoFor(videos, ice);
    return (
      <li key={ice.iceId} className="chug-done">
        {video ? (
          <button type="button" className="chug-thumb" aria-label={`Play ${label} chug`} onClick={() => setPlaying({ mediaId: video.mediaId, label })}>
            {/* Safari paints nothing for preload="metadata" until a seek; the fragment asks for the first frame. */}
            <video src={`${video.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden onError={onVideoError} />
            <MediaPlayerIcon width={20} height={20} className="chug-thumb-play" />
          </button>
        ) : (
          <span className="chug-thumb chug-thumb-empty">Done</span>
        )}
        <span className="chug-week">W{ice.week}</span>
        <span className="chug-cause">{cause}</span>
      </li>
    );
  };

  return (
    <section className="xp-group" aria-labelledby="chug-board">
      <h3 id="chug-board" className="xp-group-title">
        Chug Board
      </h3>
      {board.length === 0 ? (
        <p className="italic">Nobody owes a chug this week.</p>
      ) : (
        <ul className="chug-board" aria-label="Chug Board">
          {board.map(({ rosterId, ices }) => {
            const name = teamFor(rosterId).name;
            return (
              <li key={rosterId} className="chug-board-team">
                <DrillLink to={{ kind: "team", rosterId }}>
                  <TeamName name={name} iced={ices.some((r) => r.ice.status === "owed")} ices={0} isMine={rosterId === myRosterId} />
                </DrillLink>
                <ul aria-label={`${name} chugs`} className="chug-board-ices">
                  {ices.map(cell)}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      {upload && createPortal(<UploadChug ices={ledger.ices} initialIceIds={[upload]} onClose={() => setUpload(null)} />, document.body)}
      {playing &&
        playingVideo &&
        createPortal(
          <ChugPlayer video={playingVideo} label={playing.label} onError={onVideoError} onClose={() => setPlaying(null)} />,
          document.body,
        )}
    </section>
  );
}
