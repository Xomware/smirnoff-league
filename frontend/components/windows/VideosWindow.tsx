"use client";

import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

import { FilterBar, FilterEmpty } from "@/components/filters/FilterBar";
import { canUpload, teamList, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { VideoSocial } from "@/components/videos/VideoSocial";
import { DrillLink } from "@/components/views/drill-link";
import { IceCause } from "@/components/views/week-ices";
import { TeamName } from "@/components/xp/TeamName";
import type { LedgerIce } from "@/lib/api/ledger";
import type { WindowParams } from "@/lib/desktop/windows";
import { defaultFilters, type FilterValues, plural, readFilters, useFilterParam, writeFilters } from "@/lib/filters/filters";
import { useLedger } from "@/lib/ices/use-ledger";
import { type Player, type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { clipFields, clipsOf, filterClips, iceMatches } from "@/lib/videos/filter";
import { useReactionCounts } from "@/lib/videos/use-reaction-counts";
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

export function VideosWindow({ params = {} }: { params?: WindowParams }) {
  const ledgerState = useLedger();
  const { state: videosState, onVideoError } = useVideos();
  const { data, teamFor } = useLeague();
  const { myRosterId, me } = useProfile();
  const isAdmin = me?.isAdmin ?? false;
  const [param, setParam] = useFilterParam(params);
  const [upload, setUpload] = useState<{ iceIds?: string[] } | null>(null);
  const ices = ledgerState.status === "ok" ? ledgerState.ledger.ices : [];
  const videos = videosState.status === "ok" ? videosState.videos : [];
  const clips = clipsOf(videos, ices);
  const fields = clipFields(clips, ices, (r) => teamFor(r).name);
  const f = readFilters(fields, param);
  const reactions = useReactionCounts(clips.map((c) => c.video.mediaId), f.sort === "reactions");

  if (ledgerState.status === "error") return <p role="alert">Could not load the ledger ({ledgerState.message}). Refresh to try again.</p>;
  if (ledgerState.status === "loading" || !data) return <p role="status">Rewinding the chug tapes...</p>;

  const videoFor = (ice: LedgerIce) => findVideo(videos, ice);
  const shown = ices.filter((i) => iceMatches(i, f)).sort(newestFirst);
  const owes = shown.filter((i) => i.status === "owed");
  // One card per video listing every ice it covers, so a shared chug shows under each team's filter.
  const filmed = filterClips(clips, f, reactions?.byVideo ?? {}).map((clip) => ({
    ...clip,
    teams: teamList([...new Set(clip.covered.map((i) => i.rosterId))].map((r) => teamFor(r).name)),
  }));
  const unfilmed = shown.filter((i) => i.status === "completed" && !videoFor(i));
  const uploadable = ices.some((i) => canUpload(i, myRosterId, isAdmin));
  const line = (ice: LedgerIce) => <IceLine ice={ice} teamFor={teamFor} players={data.players} />;
  const set = (values: FilterValues) => setParam(writeFilters(fields, values));
  const filtered = writeFilters(fields, f) !== "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <FilterBar fields={fields} values={f} count={plural(filmed.length, "video")} onChange={set}>
        <button type="button" className="xp-button" disabled={!uploadable} onClick={() => setUpload({})}>
          Upload video...
        </button>
      </FilterBar>
      {reactions && reactions.failed > 0 && (
        <p role="note" className="xp-note">
          {plural(reactions.failed, "reaction count")} didn&apos;t load, so those chugs sort as having none.
        </p>
      )}

      {videosState.status === "error" && (
        <p role="alert" className="xp-note">
          Videos unavailable ({videosState.message}).
        </p>
      )}

      {filtered && owes.length + filmed.length + unfilmed.length === 0 ? (
        <FilterEmpty onClear={() => set(defaultFilters(fields))}>No chugs match these filters.</FilterEmpty>
      ) : (
        <>
          <Group label="Owes" count={owes.length} empty="Nobody owes a chug. Suspicious.">
            <ul className="bg-(--xp-cream)">
              {owes.map((ice) => (
                <li key={ice.iceId} className="xp-player-row ice">
                  {line(ice)}
                  {canUpload(ice, myRosterId, isAdmin) && <UploadChugButton onClick={() => setUpload({ iceIds: [ice.iceId] })} />}
                </li>
              ))}
            </ul>
          </Group>

          <Group label="Completed" count={filmed.length} empty={filtered ? "No chug videos match these filters." : "No chug videos yet."}>
            <ul className="chug-grid">
              {filmed.map(({ video, covered, teams }) => (
                <li key={video.mediaId} className="chug-card" aria-label={`${teams} chug video`}>
                  {/* Safari paints nothing for preload="metadata" until a seek; the
                      media fragment asks for the first frame and never reaches S3. */}
                  <video src={`${video.url}#t=0.1`} controls playsInline preload="metadata" onError={onVideoError} aria-label={`${teams}, week ${video.week} chug`} />
                  <ul className="chug-card-ices">
                    {covered.map((ice) => (
                      <li key={ice.iceId}>{line(ice)}</li>
                    ))}
                  </ul>
                  <p className="chug-meta">
                    {video.uploaderName ? `Posted by ${video.uploaderName}` : "Posted"} &middot; {shortDate(video.createdAt)}
                  </p>
                  <VideoSocial videoId={video.mediaId} />
                </li>
              ))}
            </ul>
          </Group>

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
        </>
      )}

      {upload && createPortal(<UploadChug ices={ices} initialIceIds={upload.iceIds} onClose={() => setUpload(null)} />, document.body)}
    </div>
  );
}
