"use client";

import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { DrillLink } from "@/components/views/drill-link";
import { IceCause } from "@/components/views/week-ices";
import { TeamName } from "@/components/xp/TeamName";
import type { LedgerIce } from "@/lib/api/ledger";
import { useLedger } from "@/lib/ices/use-ledger";
import { type Player, type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { useVideos, videoFor as findVideo } from "@/lib/videos/use-videos";

import "@/components/videos/videos.css";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

const newestFirst = (a: LedgerIce, b: LedgerIce) => b.week - a.week || a.iceId.localeCompare(b.iceId);

interface IceLineProps {
  ice: LedgerIce;
  teamFor: (rosterId: number) => Team;
  players: Record<string, Player>;
}

function IceLine({ ice, teamFor, players }: IceLineProps) {
  return (
    <span className="chug-line">
      <DrillLink to={{ kind: "week", week: ice.week }}>
        <span className="xp-player-pos">W{ice.week}</span>
      </DrillLink>
      <DrillLink to={{ kind: "team", rosterId: ice.rosterId }}>
        <TeamName name={teamFor(ice.rosterId).name} iced={ice.status === "owed"} ices={0} />
      </DrillLink>
      <span className="chug-cause">
        {ice.reason === "late" ? "Late ice" : <IceCause ice={{ ...ice, reason: ice.reason }} players={players} />}
      </span>
    </span>
  );
}

interface GroupProps {
  label: string;
  count: number;
  empty: string;
  children: ReactNode;
}

function Group({ label, count, empty, children }: GroupProps) {
  return (
    <section className="xp-group" aria-label={label}>
      <h3 className="xp-group-title">
        {label} ({count})
      </h3>
      {count === 0 ? <p className="italic">{empty}</p> : children}
    </section>
  );
}

export function VideosWindow() {
  const ledgerState = useLedger();
  const { state: videosState, onVideoError } = useVideos();
  const { data, teamFor } = useLeague();
  const { myRosterId, me } = useProfile();
  const isAdmin = me?.isAdmin ?? false;
  const [week, setWeek] = useState("all");
  const [team, setTeam] = useState("all");
  const [upload, setUpload] = useState<{ iceId?: string } | null>(null);

  if (ledgerState.status === "error") return <p role="alert">Could not load the ledger ({ledgerState.message}). Refresh to try again.</p>;
  if (ledgerState.status === "loading" || !data) return <p role="status">Rewinding the chug tapes...</p>;

  const { ices } = ledgerState.ledger;
  const videos = videosState.status === "ok" ? videosState.videos : [];
  const videoFor = (ice: LedgerIce) => findVideo(videos, ice);
  const shown = ices
    .filter((i) => (week === "all" || i.week === Number(week)) && (team === "all" || i.rosterId === Number(team)))
    .sort(newestFirst);
  const owes = shown.filter((i) => i.status === "owed");
  const filmed = shown.flatMap((ice) => {
    const video = ice.status === "completed" && videoFor(ice);
    return video ? [{ ice, video }] : [];
  });
  const unfilmed = shown.filter((i) => i.status === "completed" && !videoFor(i));
  const weeks = [...new Set(ices.map((i) => i.week))].sort((a, b) => a - b);
  const teams = [...new Set(ices.map((i) => i.rosterId))].sort((a, b) => teamFor(a).name.localeCompare(teamFor(b).name));
  const uploadable = ices.some((i) => canUpload(i, myRosterId, isAdmin));
  const line = (ice: LedgerIce) => <IceLine ice={ice} teamFor={teamFor} players={data.players} />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="chug-toolbar">
        <label className="flex items-center gap-2 font-bold">
          Week
          <select className="xp-select" value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="all">All weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold">
          Team
          <select className="xp-select" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((id) => (
              <option key={id} value={id}>
                {teamFor(id).name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="xp-button ml-auto" disabled={!uploadable} onClick={() => setUpload({})}>
          Upload video...
        </button>
      </div>

      <Group label="Owes" count={owes.length} empty="Nobody owes a chug. Suspicious.">
        <ul className="bg-(--xp-cream)">
          {owes.map((ice) => (
            <li key={ice.iceId} className="xp-player-row ice">
              {line(ice)}
              {canUpload(ice, myRosterId, isAdmin) && <UploadChugButton onClick={() => setUpload({ iceId: ice.iceId })} />}
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Completed" count={filmed.length} empty="No chug videos yet.">
        <ul className="chug-grid">
          {filmed.map(({ ice, video }) => (
            <li key={ice.iceId} className="chug-card">
              {/* Safari paints nothing for preload="metadata" until a seek; the
                  media fragment asks for the first frame and never reaches S3. */}
              <video src={`${video.url}#t=0.1`} controls playsInline preload="metadata" onError={onVideoError} aria-label={`${teamFor(ice.rosterId).name}, week ${ice.week} chug`} />
              {line(ice)}
              <p className="chug-meta">
                {video.uploaderName ? `Posted by ${video.uploaderName}` : "Posted"} &middot; {shortDate(video.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Group>
      {videosState.status === "error" && (
        <p role="alert" className="xp-note">
          Videos unavailable ({videosState.message}).
        </p>
      )}

      <Group label="Completed without video" count={unfilmed.length} empty="Every completed chug is on tape.">
        <ul className="bg-(--xp-cream)">
          {unfilmed.map((ice) => (
            <li key={ice.iceId} className="xp-player-row">
              {line(ice)}
              <span className="xp-watch-tag">{ice.completedAt ? `Completed ${shortDate(ice.completedAt)}` : "Completed"}</span>
            </li>
          ))}
        </ul>
      </Group>

      {upload && createPortal(<UploadChug ices={ices} iceId={upload.iceId} onClose={() => setUpload(null)} />, document.body)}
    </div>
  );
}
