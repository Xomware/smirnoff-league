"use client";

import type { ReactNode } from "react";

import { TeamName } from "@/components/xp/TeamName";
import { SLOTS } from "@/lib/ices/compute";
import { POLL_MS } from "@/lib/ices/use-ice-watch";
import { WATCH_TAG } from "@/lib/ices/watch";
import { type Side, useWeekGames } from "@/lib/league/use-week-games";
import { DrillLink } from "./drill-link";
import { WeekIces } from "./week-ices";

import "./game.css";

interface OpenGameProps {
  week: number;
  matchup: number;
  children?: ReactNode;
}

export function OpenGame({ week, matchup, children = "Open game" }: OpenGameProps) {
  return (
    <span className="xp-open-game">
      <DrillLink to={{ kind: "game", week, matchup }}>{children}</DrillLink>
    </span>
  );
}

interface GameViewProps {
  week: number;
  matchup: number;
}

export function GameView({ week, matchup }: GameViewProps) {
  const { data, games, live, liveGames, error, teamFor } = useWeekGames(week);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !games) return <p role="status">Loading the game...</p>;
  const game = games.find((g) => g.id === matchup);
  if (!game || game.sides.length !== 2) return <p className="xp-note">No such game in week {week}.</p>;

  const sides = game.sides;
  const [a, b] = sides;
  const name = (s: Side) => teamFor(s.rosterId).name;
  const result = (s: Side, o: Side) => (s.points > o.points ? "W" : s.points < o.points ? "L" : "T");
  const player = (id: string) => <DrillLink to={{ kind: "player", playerId: id }}>{data.players[id]?.name ?? id}</DrillLink>;
  const benchRows = Math.max(a.bench?.length ?? 0, b.bench?.length ?? 0);
  const iced = sides.filter((s) => s.iceList.length > 0).map((s): [number, typeof s.iceList] => [s.rosterId, s.iceList]);

  // A team's player and points cells, mirrored for the right-hand team so both read toward the slot column.
  const cells = (align: "left" | "right", content: ReactNode, points: string, frost = "") => {
    const pair = [
      <td key="p" className={`game-player game-${align}${frost}`}>
        {content}
      </td>,
      <td key="n" className={`tabular-nums game-${align === "left" ? "right" : "left"}`}>
        {points}
      </td>,
    ];
    return align === "left" ? pair : pair.reverse();
  };

  const starter = (s: Side, i: number, align: "left" | "right") => {
    const st = s.starters?.[i];
    if (!st) return cells(align, "-", "-");
    const tag = st.watch && WATCH_TAG[st.watch.state];
    const frost = st.iced ? " ice" : st.watch?.state === "WATCH" ? " ice-watch" : "";
    const content = (
      <>
        {st.playerId ? player(st.playerId) : "Empty"}
        {tag && <span className="xp-watch-tag">{tag}</span>}
      </>
    );
    return cells(align, content, st.points.toFixed(2), frost);
  };

  const benched = (s: Side, i: number, align: "left" | "right") => {
    const p = s.bench?.[i];
    return p ? cells(align, player(p.playerId), p.points.toFixed(2)) : cells(align, "", "");
  };

  const head = (
    <thead>
      <tr>
        <th scope="col">{name(a)}</th>
        <th scope="col" className="w-16 text-right">
          Pts
        </th>
        <th scope="col" className="w-24 text-center">
          Slot
        </th>
        <th scope="col" className="w-16">
          Pts
        </th>
        <th scope="col" className="text-right">
          {name(b)}
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="game grid gap-3">
      <section aria-label="Score" className="game-score">
        {sides.map((s, i) => (
          <div key={s.rosterId} className={`game-side game-${i === 0 ? "left" : "right"}`}>
            <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
              <TeamName name={name(s)} avatarUrl={teamFor(s.rosterId).avatarUrl} iced={s.ices > 0} ices={s.ices} />
            </DrillLink>
            <span className="game-points">
              {!live && <span className="xp-tag">{result(s, sides[1 - i])}</span>}
              {s.points.toFixed(2)}
            </span>
          </div>
        ))}
        <span className="game-state">{live ? "Live" : "Final"}</span>
      </section>
      <p aria-live="polite" className="text-xs">
        {live && liveGames > 0 && `${liveGames} NFL ${liveGames === 1 ? "game" : "games"} live. Checking every ${POLL_MS / 1000} seconds.`}
      </p>
      {sides
        .filter((s) => s.starters === null)
        .map((s) => (
          <p key={s.rosterId} className="xp-note">
            Sleeper has no lineup for {name(s)} yet.
          </p>
        ))}

      <div className="xp-table-scroll">
        <table className="xp-table game-table">
          <caption className="sr-only">Lineups</caption>
          {head}
          <tbody>
            {SLOTS.map((slot, i) => (
              <tr key={i}>
                {starter(a, i, "left")}
                <td className="game-slot">{slot}</td>
                {starter(b, i, "right")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xp-table-scroll">
        <table className="xp-table game-table">
          <caption className="sr-only">Bench</caption>
          {head}
          <tbody>
            {Array.from({ length: benchRows }, (_, i) => (
              <tr key={i}>
                {benched(a, i, "left")}
                <td className="game-slot">BN</td>
                {benched(b, i, "right")}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="game-right tabular-nums">
                {a.benchLeft?.toFixed(2) ?? "-"}
              </td>
              <th scope="row" className="game-slot" title="Points the best possible lineup would have added">
                Left on bench
              </th>
              <td colSpan={2} className="tabular-nums">
                {b.benchLeft?.toFixed(2) ?? "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section aria-label={`Week ${week} ices`} className="grid gap-2">
        <h3 className="font-bold">Ices this week</h3>
        {live && <p className="xp-note">Only empty slots count until the week ends.</p>}
        {iced.length === 0 ? <p>No ices in this game.</p> : <WeekIces groups={iced} players={data.players} teamFor={teamFor} />}
      </section>
    </div>
  );
}
