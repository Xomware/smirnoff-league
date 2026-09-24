"use client";

import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { chugTime } from "@/components/videos/ChugTime";
import { UploadChug } from "@/components/videos/UploadChug";
import { ProvisionalBoard } from "@/components/windows/IcesWindow";
import { IceBadge } from "@/components/xp/IceBadge";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Video } from "@/lib/api/videos";
import { heatCheck } from "@/lib/ices/analysis";
import { iceStandings } from "@/lib/ices/standings";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { byRoster } from "@/lib/league/drill";
import { sortStandings } from "@/lib/league/standings";
import { useProfile } from "@/lib/profile/use-profile";
import { useMediaQuery } from "@/lib/use-media-query";
import { useVideos } from "@/lib/videos/use-videos";
import { DrillLink, type DrillTarget } from "./drill-link";
import { LedgerStats } from "./ledger-stats";
import { useSeason, WeekIces } from "./week-ices";
import { WhoOwes } from "./who-owes";

import "@/components/home/chugs.css";
import "@/components/windows/ledger.css";

const NARROW = "(max-width: 639.98px)";

interface BlockProps {
  title: string;
  all?: DrillTarget;
  className?: string;
  children: ReactNode;
}

function Block({ title, all, className = "", children }: BlockProps) {
  return (
    <section className={`xp-group ov-block ${className}`} aria-label={title}>
      <div className="xp-group-title ov-head">
        <h3>{title}</h3>
        {all && (
          <span className="ov-all">
            <DrillLink to={all}>
              See all <span className="sr-only">{title}</span>
            </DrillLink>
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function IcesOverview() {
  const { data, teamFor, currentWeek, tally, finishedWeeks, error } = useSeason();
  const ledgerState = useLedger();
  const { state: videos, onVideoError } = useVideos();
  const { myRosterId } = useProfile();
  const phone = useMediaQuery(NARROW);
  const [upload, setUpload] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);
  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const now = useNow(ledger?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !finishedWeeks || !currentWeek || ledgerState.status === "loading") return <p role="status">Tallying the ices...</p>;

  const name = (rosterId: number) => teamFor(rosterId).name;
  const final = ledger?.weeks.some((w) => w.week === currentWeek && w.finalizedAt);
  const live = final ? [] : (tally.live?.ices ?? []);
  const pf = Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
  const leaders = iceStandings(tally, finishedWeeks, pf, ledger?.summary ?? null)
    .filter((r) => r.total > 0)
    .slice(0, 5);
  const heat = heatCheck(finishedWeeks)
    .filter((h) => h.score > 0)
    .slice(0, 3);
  // Only chugs for ices the ledger still holds, as in the gallery.
  const known = new Set(ledger?.ices.map((i) => i.iceId));
  const clips =
    videos.status === "ok"
      ? videos.videos.filter((v) => !ledger || v.iceIds.some((id) => known.has(id))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
  const clipLabel = (v: Video) => `${v.rosterIds.map(name).join(" & ")} · Week ${v.week}`;
  const clipTime = (v: Video) => ledger?.ices.find((i) => v.iceIds.includes(i.iceId) && i.chugSeconds)?.chugSeconds;
  const heatLine = (recent: number[]) => `Iced in ${recent.filter((n) => n > 0).length} of the last ${plural(recent.length, "week")}`;

  const latest = clips[0];
  const latestTime = latest && clipTime(latest);
  const tiles = [
    {
      label: "Recent chugs",
      value: latest ? `${name(latest.rosterIds[0])}${latestTime ? ` ${chugTime(latestTime)}` : ""}` : "None yet",
      to: { kind: "videos" } as const,
    },
    { label: "Ice leaders", value: leaders[0] ? `${name(leaders[0].rosterId)} ${leaders[0].total}` : "Nobody", to: { kind: "ice-standings" } as const },
    { label: "Heat check", value: heat[0] ? name(heat[0].rosterId) : "Nobody hot", to: { kind: "stats" } as const },
  ];

  const liveTitle = phone ? `Week ${currentWeek} · live` : `Week ${currentWeek} — live, provisional`;

  return (
    <div className="ov">
      <div className="ov-grid">
        {ledger ? (
          <Block title="Season at a glance" className="ledger-stats ov-wide">
            <LedgerStats ledger={ledger} now={now} teamFor={teamFor} compact={phone} />
          </Block>
        ) : (
          <p role="note" className="xp-note ov-wide">
            Ledger unavailable ({ledgerState.status === "error" && ledgerState.message}). Showing owed ices from Sleeper scores.
          </p>
        )}

        <Block title="Who owes now" all={{ kind: "ices" }} className="who-owes">
          {ledger ? (
            <WhoOwes
              ledger={ledger}
              now={now}
              players={data.players}
              teamFor={teamFor}
              myRosterId={myRosterId}
              onUpload={setUpload}
              compact={phone}
            />
          ) : (
            <div className="xp-table-scroll">
              <ProvisionalBoard owed={tally.owed} teamFor={teamFor} />
            </div>
          )}
        </Block>

        {(!phone || live.length > 0) && (
          <Block title={liveTitle} all={{ kind: "watch" }}>
            {final ? (
              <p>Week {currentWeek} is final. Its ices are on the ledger.</p>
            ) : live.length === 0 ? (
              <p>No empty slots this week.</p>
            ) : (
              <WeekIces groups={byRoster(live)} players={data.players} teamFor={teamFor} />
            )}
          </Block>
        )}

        {phone ? (
          <section className="xp-group ledger-stats ov-wide" aria-label="More">
            <ul aria-label="More from the ices" className="ledger-stat-grid ov-tiles" data-compact>
              {tiles.map((t) => (
                <li key={t.label} className="ledger-stat">
                  <DrillLink to={t.to}>
                    <span className="ledger-stat-label">{t.label}</span>
                    <span className="ledger-stat-sub">{t.value}</span>
                  </DrillLink>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <Block title="Recent chugs" all={{ kind: "videos" }}>
              {videos.status === "loading" ? (
                <p role="status">Rewinding the chug tapes...</p>
              ) : videos.status === "error" ? (
                <p role="alert">Chug videos unavailable ({videos.message}).</p>
              ) : clips.length === 0 ? (
                <p>No chugs on tape yet.</p>
              ) : (
                <ul aria-label="Recent chugs" className="ov-clips">
                  {clips.slice(0, 3).map((v) => {
                    const time = clipTime(v);
                    return (
                      <li key={v.mediaId}>
                        <button type="button" className="chug-reel-clip" aria-label={`Watch ${clipLabel(v)} chug`} onClick={() => setPlaying(v)}>
                          {/* Safari paints nothing for preload="metadata" until a seek; the fragment asks for the first frame. */}
                          <video src={`${v.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden onError={onVideoError} />
                          <MediaPlayerIcon width={24} height={24} className="chug-thumb-play" />
                          <span className="chug-reel-caption">
                            {clipLabel(v)}
                            {time ? ` · ${chugTime(time)}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Block>

            <Block title="Ice leaders" all={{ kind: "ice-standings" }}>
              {leaders.length === 0 ? (
                <p>Nobody has an ice yet.</p>
              ) : (
                <ol aria-label="Ice leaders" className="grid">
                  {leaders.map((r) => (
                    <li key={r.rosterId} className="ov-row">
                      <span className="ov-rank">{r.rank}</span>
                      <DrillLink to={{ kind: "team", rosterId: r.rosterId }}>
                        <TeamName name={name(r.rosterId)} iced ices={0} isMine={r.rosterId === myRosterId} />
                      </DrillLink>
                      <IceBadge count={r.total} season />
                    </li>
                  ))}
                </ol>
              )}
            </Block>

            <Block title="Heat check" all={{ kind: "stats" }}>
              {heat.length === 0 ? (
                <p>Nobody is running hot. Enjoy it.</p>
              ) : (
                <ol aria-label="Most likely to ice next" className="grid">
                  {heat.map((h, i) => (
                    <li key={h.rosterId} className="ov-row">
                      <span className="ov-rank">{i + 1}</span>
                      <span className="min-w-0">
                        <DrillLink to={{ kind: "team", rosterId: h.rosterId }}>{name(h.rosterId)}</DrillLink>
                        <span className="ov-sub">{heatLine(h.recent)}</span>
                      </span>
                      <span className="ov-score">{h.score} pts</span>
                    </li>
                  ))}
                </ol>
              )}
            </Block>
          </>
        )}

      </div>
      {ledger && upload && createPortal(<UploadChug ices={ledger.ices} initialIceIds={upload} onClose={() => setUpload(null)} />, document.body)}
      {playing && createPortal(<ChugPlayer video={playing} label={clipLabel(playing)} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </div>
  );
}
