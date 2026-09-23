"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { canTime, ChugTimeButton, ChugTimeDialog, chugTime } from "@/components/videos/ChugTime";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { MediaPlayerIcon } from "@/components/xp/icons";
import type { LedgerIce } from "@/lib/api/ledger";
import type { LedgerState } from "@/lib/ices/use-ledger";
import type { ResultRow } from "@/lib/league/profile";
import { type Player, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { useVideos, videoFor } from "@/lib/videos/use-videos";
import { DrillLink } from "./drill-link";
import { inLedgerOrder, paidOn } from "./ledger-week";

export const REASONS: Record<LedgerIce["reason"], string> = {
  zero: "Zero points",
  empty: "Empty slot",
  lowest: "Lowest score",
  admin: "Admin ice",
  late: "Late ice",
};

// Without the ledger, the ices Sleeper's scores imply, marked provisional.
export function teamIceRows(rosterId: number, ledger: Exclude<LedgerState, { status: "loading" }>, results: ResultRow[]) {
  const provisional = ledger.status === "error";
  const ices: LedgerIce[] = provisional
    ? results.flatMap((r) => r.ices.map(({ id, ...ice }): LedgerIce => ({ ...ice, iceId: id, status: "owed" })))
    : ledger.ledger.ices.filter((i) => i.rosterId === rosterId);
  const weeks = [...new Set(ices.map((i) => i.week))].sort((a, b) => a - b);
  return { provisional, rows: weeks.flatMap((w) => inLedgerOrder(ices.filter((i) => i.week === w))) };
}

interface TeamIcesProps {
  rosterId: number;
  ledger: LedgerState;
  results: ResultRow[];
  players: Record<string, Player>;
}

export function TeamIces({ rosterId, ledger, results, players }: TeamIcesProps) {
  const { state: videosState, onVideoError } = useVideos();
  const { teamFor } = useLeague();
  const { myRosterId, me } = useProfile();
  const [playing, setPlaying] = useState<LedgerIce | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [timing, setTiming] = useState<LedgerIce | null>(null);

  if (ledger.status === "loading") return <p role="status">Loading the ledger...</p>;

  const { provisional, rows } = teamIceRows(rosterId, ledger, results);
  const videos = videosState.status === "ok" ? videosState.videos : [];
  const playingVideo = playing && videoFor(videos, playing);
  const uploadable = (ice: LedgerIce) => !provisional && !videoFor(videos, ice) && canUpload(ice, myRosterId, me?.isAdmin ?? false);
  const timeable = (ice: LedgerIce) => !provisional && canTime(ice, myRosterId, me?.isAdmin ?? false);

  const videoCell = (ice: LedgerIce) => {
    const video = !provisional && videoFor(videos, ice);
    if (video) {
      return (
        <button type="button" className="xp-drill items-center gap-1" aria-label={`Play ${iceLabel(ice, teamFor, players)}`} onClick={() => setPlaying(ice)}>
          <MediaPlayerIcon className="shrink-0" />
          Play
        </button>
      );
    }
    // Listed on the ledger but not (yet) in the video list: loading, or the list failed.
    if (ice.videoId) return "Uploaded";
    return (
      <span className="flex items-center gap-2">
        None
        {uploadable(ice) && <UploadChugButton onClick={() => setUploadFor(ice.iceId)} />}
      </span>
    );
  };

  return (
    <div className="grid gap-2">
      {ledger.status === "error" && (
        <p role="note" className="xp-note">
          Ledger unavailable ({ledger.message}). These are Sleeper&apos;s ices, not yet confirmed.
        </p>
      )}
      <div className="xp-table-scroll">
        <table className="xp-table">
          <caption className="sr-only">Season ices</caption>
          <thead>
            <tr>
              <th scope="col" className="w-18">Week</th>
              <th scope="col">Reason</th>
              <th scope="col">Player</th>
              <th scope="col" className="w-24">Status</th>
              <th scope="col" className="w-20">Paid</th>
              <th scope="col" className={rows.some(uploadable) ? "w-38" : "w-20"}>
                Video
              </th>
              <th scope="col" className={rows.some(timeable) ? "w-32" : "w-16"}>
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>No ices this season. Stay thirsty.</td>
              </tr>
            )}
            {rows.map((ice) => {
              const late = ice.reason === "late";
              return (
                <tr key={ice.iceId} className={ice.status === "owed" && !provisional ? "profile-owed" : undefined}>
                  <td className="whitespace-nowrap">{late ? "" : <DrillLink to={{ kind: "week", week: ice.week }}>Week {ice.week}</DrillLink>}</td>
                  <td className={late ? "pl-6 whitespace-nowrap" : undefined}>
                    {late ? `Late ice ${ice.iceId.split("#LATE")[1]}` : REASONS[ice.reason]}
                  </td>
                  <td>
                    {ice.playerId ? (
                      <DrillLink to={{ kind: "player", playerId: ice.playerId }}>{players[ice.playerId]?.name ?? ice.playerId}</DrillLink>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="font-bold whitespace-nowrap">{provisional ? "Provisional" : ice.status === "owed" ? "Owed" : "Completed"}</td>
                  <td className="whitespace-nowrap tabular-nums">{ice.completedAt ? paidOn(ice.completedAt) : "-"}</td>
                  <td className="whitespace-nowrap">{videoCell(ice)}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    <span className="flex items-center gap-2">
                      {ice.chugSeconds === undefined ? "-" : chugTime(ice.chugSeconds)}
                      {timeable(ice) && <ChugTimeButton ice={ice} onClick={() => setTiming(ice)} />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {playing &&
        playingVideo &&
        createPortal(
          <ChugPlayer video={playingVideo} label={iceLabel(playing, teamFor, players)} onError={onVideoError} onClose={() => setPlaying(null)} />,
          document.body,
        )}
      {uploadFor &&
        ledger.status === "ok" &&
        createPortal(<UploadChug ices={ledger.ledger.ices} initialIceIds={[uploadFor]} onClose={() => setUploadFor(null)} />, document.body)}
      {timing && <ChugTimeDialog ice={timing} label={iceLabel(timing, teamFor, players)} onClose={() => setTiming(null)} />}
    </div>
  );
}
