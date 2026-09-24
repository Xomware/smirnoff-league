"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { FilterBar, FilterEmpty } from "@/components/filters/FilterBar";
import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { teamList } from "@/components/videos/UploadChug";
import { BoardHead } from "@/components/views/board";
import { DrillLink } from "@/components/views/drill-link";
import { IceLedger } from "@/components/windows/IcesWindow";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName, TroubleTags } from "@/components/xp/TeamName";
import type { Ledger } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { WindowParams } from "@/lib/desktop/windows";
import { defaultFilters, type FilterValues, plural, readFilters, useFilterParam, writeFilters } from "@/lib/filters/filters";
import { type IceStanding, iceStandings, weekIceStandings } from "@/lib/ices/standings";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useTrouble } from "@/lib/ices/use-trouble";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { clipFields, clipsOf, filterClips } from "@/lib/videos/filter";
import { useReactionCounts } from "@/lib/videos/use-reaction-counts";
import { useVideos } from "@/lib/videos/use-videos";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

function breakdown(r: IceStanding): string {
  const parts = [
    r.reasons.zero && `${r.reasons.zero} zero`,
    r.reasons.empty && `${r.reasons.empty} empty`,
    r.reasons.lowest && `${r.reasons.lowest} lowest`,
    r.completed && `${r.completed} paid`,
    r.late && `${r.late} late`,
    r.streak && `${r.streak}-week streak`,
    r.score && `scored ${r.score.points.toFixed(2)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Clean so far";
}

// The desktop ledger, with the season summary folded away.
export function LedgerScreen({ params }: { params: WindowParams }) {
  return <IceLedger params={params} phone />;
}

export function VideosScreen({ params }: { params: WindowParams }) {
  const { teamFor } = useLeague();
  const ledger = useLedger();

  if (ledger.status === "loading") return <p role="status">Rewinding the chug tapes...</p>;
  if (ledger.status === "error") return <p role="alert">The ledger is unavailable ({ledger.message}), so the videos are hidden.</p>;
  return (
    <div className="m-page">
      <Gallery ledger={ledger.ledger} teamFor={teamFor} params={params} />
    </div>
  );
}

interface GalleryProps {
  ledger: Ledger;
  teamFor: (rosterId: number) => Team;
  params: WindowParams;
}

function Gallery({ ledger, teamFor, params }: GalleryProps) {
  const { state, onVideoError } = useVideos();
  const [playing, setPlaying] = useState<Video | null>(null);
  const [param, setParam] = useFilterParam(params);
  const clips = clipsOf(state.status === "ok" ? state.videos : [], ledger.ices);
  const fields = clipFields(clips, clips.flatMap((c) => c.covered), (r) => teamFor(r).name);
  const f = readFilters(fields, param);
  const reactions = useReactionCounts(clips.map((c) => c.video.mediaId), f.sort === "reactions");
  const videos = filterClips(clips, f, reactions?.byVideo ?? {}).map((c) => c.video);
  const set = (values: FilterValues) => setParam(writeFilters(fields, values));
  const label = (v: Video) => `${teamList(v.rosterIds.map((r) => teamFor(r).name))} · Week ${v.week}`;

  return (
    <section aria-labelledby="m-gallery" className="m-section">
      <h2 id="m-gallery" className="m-section-title">
        Chug videos
      </h2>
      {state.status === "loading" ? (
        <p role="status">Rewinding the chug tapes...</p>
      ) : state.status === "error" ? (
        <p role="alert">Chug videos unavailable ({state.message}).</p>
      ) : clips.length === 0 ? (
        <p className="m-empty">No chug videos yet.</p>
      ) : (
        <>
          <FilterBar fields={fields} values={f} count={plural(videos.length, "video")} onChange={set} />
          {reactions && reactions.failed > 0 && (
            <p role="note" className="xp-note">
              {plural(reactions.failed, "reaction count")} didn&apos;t load, so those chugs sort as having none.
            </p>
          )}
          {videos.length === 0 ? (
            <FilterEmpty onClear={() => set(defaultFilters(fields))}>No chugs match these filters.</FilterEmpty>
          ) : (
            <ul aria-label="Chug videos" className="m-gallery">
              {videos.map((v) => (
                <li key={v.mediaId}>
                  <button type="button" className="m-clip" aria-label={`Watch ${label(v)} chug`} onClick={() => setPlaying(v)}>
                    {/* Safari paints nothing for preload="metadata" until a seek; the fragment asks for the first frame. */}
                    <video src={`${v.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden onError={onVideoError} />
                    <MediaPlayerIcon width={32} height={32} className="m-clip-play" />
                    <span className="m-clip-caption">
                      {teamList(v.rosterIds.map((r) => teamFor(r).name))}
                      <span className="block font-normal">
                        Week {v.week} · {shortDate(v.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {playing &&
        createPortal(<ChugPlayer video={playing} label={label(playing)} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </section>
  );
}

export function IceStandingsScreen() {
  const { data, error: leagueError, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, finishedWeeks, liveMatchups, error: icesError } = useSeasonIces(currentWeek);
  const ledger = useLedger();
  const week = useDefaultWeek();
  const [mode, setMode] = useState<"season" | "week">("season");
  const trouble = useTrouble();
  const error = leagueError ?? icesError;

  const rows = useMemo(() => {
    if (!data || !tally || !finishedWeeks || ledger.status === "loading" || week === undefined) return null;
    const ok = ledger.status === "ok" ? ledger.ledger : null;
    const pf = Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
    const season = iceStandings(tally, finishedWeeks, pf, ok?.summary ?? null);
    if (mode === "season") return season;
    const live = tally.live?.week === week;
    const ices = live ? tally.live : tally.weeks.find((w) => w.week === week);
    const matchups = live ? (liveMatchups ?? []) : (finishedWeeks.find((w) => w.week === week)?.matchups ?? []);
    return ices ? weekIceStandings(season.map((r) => r.rosterId), ices, matchups, live, ok) : [];
  }, [data, tally, finishedWeeks, liveMatchups, ledger, week, mode]);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!rows || week === undefined) return <p role="status">Ranking the shame...</p>;
  const live = tally?.live?.week === week;

  return (
    <div className="m-page">
      <div role="group" aria-label="Ice standings for" className="m-segmented">
        <button type="button" aria-pressed={mode === "season"} onClick={() => setMode("season")}>
          Season
        </button>
        <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>
          Week {week}
        </button>
      </div>
      {mode === "week" && live && <p className="m-caption">Week {week} is live: empty slots count once every game has kicked off.</p>}
      <div className="m-card m-rows m-ice-board">
        <BoardHead labels={["RK", "Team", "Ices"]} />
        <ol aria-label="Ice standings">
          {rows.map((r) => (
            <li key={r.rosterId} className={`board-row${r.rosterId === myRosterId ? " m-mine" : ""}`}>
              <span className="board-rank m-rank">{r.rank}</span>
              <span className="board-who">
                <DrillLink to={{ kind: "team", rosterId: r.rosterId }}>
                  <TeamName name={teamFor(r.rosterId).name} iced={r.total > 0} ices={0} isMine={r.rosterId === myRosterId} badges={false} />
                </DrillLink>
                <span className="board-sub">
                  <TroubleTags trouble={trouble.of(r.rosterId)} />
                  <span>{breakdown(r)}</span>
                </span>
              </span>
              <span className="board-num">
                {r.total}
                <span className="sr-only">{r.total === 1 ? " ice" : " ices"}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
