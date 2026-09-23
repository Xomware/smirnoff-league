"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { DrillLink } from "@/components/views/drill-link";
import { paidOn } from "@/components/views/ledger-week";
import { REASONS, teamIceRows } from "@/components/views/team-ices";
import { TYPES, useTeamMoves } from "@/components/views/team-moves";
import { PointsChart, ProfileHead, type TeamProfile, useTeamProfile } from "@/components/views/team-view";
import { IceCause } from "@/components/views/week-ices";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { LedgerIce } from "@/lib/api/ledger";
import { SLOTS } from "@/lib/ices/compute";
import type { WindowParams } from "@/lib/desktop/windows";
import type { Pick } from "@/lib/league/profile";
import { useProfile } from "@/lib/profile/use-profile";
import { useVideos, videoFor } from "@/lib/videos/use-videos";
import { JumpSections } from "./JumpSections";

import "@/components/views/profile.css";

const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

interface Props {
  p: TeamProfile;
}

function Opponent({ p, rosterId }: Props & { rosterId: number }) {
  return (
    <DrillLink to={{ kind: "team", rosterId }}>
      <TeamName name={p.teamFor(rosterId).name} avatarUrl={p.teamFor(rosterId).avatarUrl} iced={false} ices={0} />
    </DrillLink>
  );
}

function Results({ p }: Props) {
  if (p.results.length === 0) return <p className="m-empty">No finished weeks yet.</p>;
  return (
    <>
      <ul aria-label="Weekly results" className="m-card m-rows">
        {p.results.map((r) => (
          <li key={r.week} className="m-result">
            <span className="m-result-top">
              <DrillLink to={{ kind: "week", week: r.week }}>Week {r.week}</DrillLink>
              {r.result && (
                <span className="m-result-pill" data-result={r.result}>
                  {r.result}
                </span>
              )}
              <span className="m-points">
                {r.points.toFixed(2)}
                {r.opponent && ` - ${r.opponent.points.toFixed(2)}`}
              </span>
            </span>
            <span className="m-result-vs">vs {r.opponent ? <Opponent p={p} rosterId={r.opponent.rosterId} /> : "Bye"}</span>
            <span className="m-caption">
              {r.margin !== null && `Margin ${signed(r.margin)} · `}
              {r.benchLeft !== null && `${r.benchLeft.toFixed(2)} left on the bench · `}
              {r.ices.length === 0 ? "No ices" : "Iced: "}
              {r.ices.map((ice, i) => (
                <Fragment key={ice.id}>
                  {i > 0 && ", "}
                  <IceCause ice={ice} players={p.data.players} />
                </Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <PointsChart results={p.results} name={p.team.name} />
    </>
  );
}

function Ices({ p }: Props) {
  const { state, onVideoError } = useVideos();
  const { myRosterId, me } = useProfile();
  const [playing, setPlaying] = useState<LedgerIce | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const { ledger } = p;

  if (ledger.status === "loading") return <p role="status">Loading the ledger...</p>;
  const { provisional, rows } = teamIceRows(p.rosterId, ledger, p.results);
  const videos = state.status === "ok" ? state.videos : [];
  const playingVideo = playing && videoFor(videos, playing);
  if (rows.length === 0) return <p className="m-empty">No ices this season. Stay thirsty.</p>;

  return (
    <>
      {ledger.status === "error" && <p className="xp-note">Ledger unavailable ({ledger.message}). These are Sleeper&apos;s ices, not yet confirmed.</p>}
      <ul aria-label="Season ices" className="m-card m-rows">
        {rows.map((ice) => {
          const late = ice.reason === "late";
          const video = !provisional && videoFor(videos, ice);
          const status = provisional ? "Provisional" : ice.status === "owed" ? "Owed" : ice.completedAt ? `Paid ${paidOn(ice.completedAt)}` : "Paid";
          return (
            <li key={ice.iceId} className={`m-player${ice.status === "owed" && !provisional ? " ice" : ""}`}>
              <span className="m-slot">{late ? "LATE" : `W${ice.week}`}</span>
              <span className="m-player-name">
                <b>{late ? `Late ice ${ice.iceId.split("#LATE")[1]}` : REASONS[ice.reason]}</b>
                {ice.playerId && (
                  <DrillLink to={{ kind: "player", playerId: ice.playerId }}>{p.playerName(ice.playerId)}</DrillLink>
                )}
                <span className="m-caption">{status}</span>
              </span>
              {video ? (
                <button type="button" className="m-play" aria-label={`Play ${iceLabel(ice, p.teamFor, p.data.players)}`} onClick={() => setPlaying(ice)}>
                  <MediaPlayerIcon width={20} height={20} />
                  Play
                </button>
              ) : (
                ledger.status === "ok" &&
                ice.status === "owed" &&
                canUpload(ice, myRosterId, me?.isAdmin ?? false) && <UploadChugButton onClick={() => setUploadFor(ice.iceId)} />
              )}
            </li>
          );
        })}
      </ul>
      {playing &&
        playingVideo &&
        createPortal(
          <ChugPlayer video={playingVideo} label={iceLabel(playing, p.teamFor, p.data.players)} onError={onVideoError} onClose={() => setPlaying(null)} />,
          document.body,
        )}
      {uploadFor &&
        ledger.status === "ok" &&
        createPortal(<UploadChug ices={ledger.ledger.ices} initialIceIds={[uploadFor]} onClose={() => setUploadFor(null)} />, document.body)}
    </>
  );
}

function Moves({ p }: Props) {
  const state = useTeamMoves(p.rosterId, p.currentWeek);
  if (state.status === "loading") return <p role="status">Loading transactions...</p>;
  if (state.status === "error") return <p role="alert">Could not load transactions ({state.message}).</p>;
  if (state.moves.length === 0) return <p className="m-empty">No adds, drops or trades yet.</p>;

  const list = (ids: string[], picks: Pick[]) =>
    [
      ...ids.map((id) => (
        <DrillLink key={id} to={{ kind: "player", playerId: id }}>
          {p.playerName(id)}
        </DrillLink>
      )),
      ...picks.map((k) => `${k.season} round ${k.round}${k.original === p.rosterId ? "" : ` (${p.teamFor(k.original).name})`}`),
    ].map((item, i) => (
      <Fragment key={i}>
        {i > 0 && ", "}
        {item}
      </Fragment>
    ));

  return (
    <ul aria-label="Transactions" className="m-card m-rows">
      {state.moves.map((m) => (
        <li key={m.id} className="m-result">
          <span className="m-result-top">
            <b>
              Week {m.week} · {TYPES[m.type]}
            </b>
            {m.partners.map((id) => (
              <span key={id}>
                with <DrillLink to={{ kind: "team", rosterId: id }}>{p.teamFor(id).name}</DrillLink>
              </span>
            ))}
          </span>
          {m.added.length + m.picksIn.length > 0 && (
            <span>
              <b className="m-plus">Added</b> {list(m.added, m.picksIn)}
            </span>
          )}
          {m.dropped.length + m.picksOut.length > 0 && (
            <span>
              <b className="m-minus">Dropped</b> {list(m.dropped, m.picksOut)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function HeadToHead({ p }: Props) {
  return (
    <ul aria-label="Head-to-head" className="m-card m-rows">
      {p.headToHead.map((h) => {
        const played = h.wins + h.losses + h.ties > 0;
        return (
          <li key={h.rosterId} className="m-row">
            <Opponent p={p} rosterId={h.rosterId} />
            <span className="m-record">
              {played ? `${h.wins}-${h.losses}${h.ties ? `-${h.ties}` : ""}` : "Not played"}
            </span>
            {played && (
              <span className="m-row-sub">
                {h.pf.toFixed(2)} for, {h.pa.toFixed(2)} against
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Lineup({ p }: Props) {
  const { lineup, mine } = p;
  if (!lineup || !mine?.starters) return <p className="m-empty">No lineup from Sleeper yet.</p>;
  const row = (id: string, slot: string, iced: boolean) => (
    <li key={`${slot}-${id}`} className={`m-player${iced ? " ice" : ""}`}>
      <span className="m-slot">{slot}</span>
      <span className="m-player-name">
        {id === "0" ? "Empty" : <DrillLink to={{ kind: "player", playerId: id }}>{p.playerName(id)}</DrillLink>}
      </span>
      <span className="m-points">{(p.points.get(id) ?? 0).toFixed(2)}</span>
    </li>
  );
  return (
    <>
      <p className="m-caption">Week {lineup.week} starters, then the bench. Points are season totals.</p>
      <ul aria-label={`Starters, week ${lineup.week}`} className="m-card m-rows">
        {SLOTS.map((slot, i) => row(mine.starters![i] || "0", slot, p.icedSlots.has(i)))}
      </ul>
      {p.bench.length > 0 && (
        <ul aria-label={`Bench, week ${lineup.week}`} className="m-card m-rows">
          {p.bench.map((id) => row(id, p.data.players[id]?.position ?? "BN", false))}
        </ul>
      )}
    </>
  );
}

function TeamProfileScreen({ rosterId }: { rosterId: number }) {
  const profile = useTeamProfile(rosterId);
  if (profile.status === "error") return <p role="alert">Could not reach Sleeper ({profile.error}). Refresh to try again.</p>;
  if (profile.status === "loading") return <p role="status">Loading the team...</p>;

  return (
    <div className="m-page">
      <ProfileHead profile={profile} />
      <JumpSections
        label={`${profile.team.name} sections`}
        sections={[
          { label: "Results", panel: () => <Results p={profile} /> },
          { label: "Ices", panel: () => <Ices p={profile} /> },
          { label: "Moves", panel: () => <Moves p={profile} /> },
          { label: "Head-to-head", panel: () => <HeadToHead p={profile} /> },
          { label: "Lineup", panel: () => <Lineup p={profile} /> },
        ]}
      />
    </div>
  );
}

export function TeamScreen({ params }: { params: WindowParams }) {
  return <TeamProfileScreen rosterId={Number(params.rosterId)} />;
}

export function MyTeamScreen() {
  const { myRosterId, setEditing } = useProfile();
  if (myRosterId !== null) return <TeamProfileScreen rosterId={myRosterId} />;
  return (
    <div className="m-page">
      <p>You haven&apos;t claimed a team yet.</p>
      <button type="button" className="m-button" onClick={() => setEditing(true)}>
        Pick your team
      </button>
    </div>
  );
}
