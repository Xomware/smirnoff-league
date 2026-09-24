"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { BoardHead } from "@/components/views/board";
import { DrillLink } from "@/components/views/drill-link";
import { OpenGame } from "@/components/views/game-view";
import { paidOn } from "@/components/views/ledger-week";
import { REASONS, teamIceRows } from "@/components/views/team-ices";
import { TYPES, useTeamMoves } from "@/components/views/team-moves";
import { PointsChart, ProfileHead, type TeamProfile, useTeamProfile } from "@/components/views/team-view";
import { IceCause } from "@/components/views/week-ices";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { Tabs } from "@/components/xp/Tabs";
import { TeamName, TroubleTags } from "@/components/xp/TeamName";
import type { LedgerIce } from "@/lib/api/ledger";
import { SLOTS } from "@/lib/ices/compute";
import { useTrouble } from "@/lib/ices/use-trouble";
import type { WindowParams } from "@/lib/desktop/windows";
import type { Pick } from "@/lib/league/profile";
import { useProfile } from "@/lib/profile/use-profile";
import { useVideos, videoFor } from "@/lib/videos/use-videos";

import "@/components/views/profile.css";

interface Props {
  p: TeamProfile;
}

function Opponent({ p, rosterId }: Props & { rosterId: number }) {
  return (
    <DrillLink to={{ kind: "team", rosterId }}>
      <TeamName name={p.teamFor(rosterId).name} avatarUrl={p.teamFor(rosterId).avatarUrl} iced={false} ices={0} badges={false} />
    </DrillLink>
  );
}

// A board's name column is too narrow for the tags, so they move to the sub line.
function Results({ p }: Props) {
  const trouble = useTrouble();
  if (p.results.length === 0) return <p className="m-empty">No finished weeks yet.</p>;
  return (
    <>
      <div className="m-card m-rows m-results">
        <BoardHead labels={["WK", "Opponent", "", "Pts"]} />
        <ul aria-label="Weekly results">
          {p.results.map((r) => (
            <li key={r.week} className="board-row">
              <span className="board-rank">
                <DrillLink to={{ kind: "week", week: r.week }}>
                  <span aria-hidden="true">W{r.week}</span>
                  <span className="sr-only">Week {r.week}</span>
                </DrillLink>
              </span>
              <span className="board-who">
                <span className="board-name">{r.opponent ? <Opponent p={p} rosterId={r.opponent.rosterId} /> : "Bye"}</span>
                <span className="board-sub m-result-detail">
                  {r.opponent && <TroubleTags trouble={trouble.of(r.opponent.rosterId)} />}
                  {r.opponent && `${r.opponent.points.toFixed(2)} against · `}
                  {r.benchLeft !== null && `${r.benchLeft.toFixed(2)} left on the bench · `}
                  {r.ices.length === 0 ? "No ices" : "Iced: "}
                  {r.ices.map((ice, i) => (
                    <Fragment key={ice.id}>
                      {i > 0 && ", "}
                      <IceCause ice={ice} players={p.data.players} />
                    </Fragment>
                  ))}
                </span>
              </span>
              <span>
                {r.result && (
                  <span className="m-result-pill" data-result={r.result}>
                    {r.result}
                  </span>
                )}
              </span>
              <span className="board-num">
                {r.opponent && r.matchupId ? (
                  <OpenGame week={r.week} matchup={r.matchupId}>
                    {r.points.toFixed(2)}{" "}
                    <span className="sr-only">- {r.opponent.points.toFixed(2)}</span>
                  </OpenGame>
                ) : (
                  r.points.toFixed(2)
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
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
  const trouble = useTrouble();
  return (
    <div className="m-card m-rows m-h2h">
      <BoardHead labels={["Opponent", "W-L", "PF", "PA"]} numbersFrom={1} />
      <ul aria-label="Head-to-head">
        {p.headToHead.map((h) => (
          <li key={h.rosterId} className="board-row">
            <span className="board-who">
              <span className="board-name">
                <Opponent p={p} rosterId={h.rosterId} />
              </span>
              {trouble.of(h.rosterId).length > 0 && (
                <span className="board-sub">
                  <TroubleTags trouble={trouble.of(h.rosterId)} />
                </span>
              )}
            </span>
            {h.wins + h.losses + h.ties > 0 ? (
              <>
                <span className="board-num">
                  {h.wins}-{h.losses}
                  {h.ties > 0 && `-${h.ties}`}
                </span>
                <span className="board-num">
                  <span className="sr-only">Points for </span>
                  {h.pf.toFixed(2)}
                </span>
                <span className="board-num">
                  <span className="sr-only">Points against </span>
                  {h.pa.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="board-none">Not played</span>
            )}
          </li>
        ))}
      </ul>
    </div>
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

function TeamProfileScreen({ rosterId, tab }: { rosterId: number; tab?: string | number }) {
  const profile = useTeamProfile(rosterId);
  if (profile.status === "error") return <p role="alert">Could not reach Sleeper ({profile.error}). Refresh to try again.</p>;
  if (profile.status === "loading") return <p role="status">Loading the team...</p>;

  return (
    <div className="m-page">
      <ProfileHead profile={profile} />
      <Tabs
        label={`${profile.team.name} sections`}
        selected={tab}
        tabs={[
          { id: "results", label: "Results", panel: () => <Results p={profile} /> },
          { id: "ices", label: "Ices", panel: () => <Ices p={profile} /> },
          { id: "moves", label: "Moves", panel: () => <Moves p={profile} /> },
          { id: "head-to-head", label: "Head-to-head", panel: () => <HeadToHead p={profile} /> },
          { id: "roster", label: "Lineup", panel: () => <Lineup p={profile} /> },
        ]}
      />
    </div>
  );
}

export function TeamScreen({ params }: { params: WindowParams }) {
  return <TeamProfileScreen rosterId={Number(params.rosterId)} tab={params.tab} />;
}

export function MyTeamScreen({ params }: { params: WindowParams }) {
  const { myRosterId, setEditing } = useProfile();
  if (myRosterId !== null) return <TeamProfileScreen rosterId={myRosterId} tab={params.tab} />;
  return (
    <div className="m-page">
      <p>You haven&apos;t claimed a team yet.</p>
      <button type="button" className="m-button" onClick={() => setEditing(true)}>
        Pick your team
      </button>
    </div>
  );
}
