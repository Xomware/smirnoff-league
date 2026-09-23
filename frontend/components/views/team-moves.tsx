"use client";

import { Fragment, useEffect, useState } from "react";

import { leagueTransactions } from "@/lib/league/cache";
import { type Pick, type TeamMove, teamTransactions } from "@/lib/league/profile";
import type { Player, Team } from "@/lib/league/use-league";
import type { SleeperTransaction } from "@/lib/sleeper/types";
import { DrillLink } from "./drill-link";

const TYPES: Record<SleeperTransaction["type"], string> = {
  free_agent: "Free agent",
  waiver: "Waiver",
  trade: "Trade",
  commissioner: "Commish",
};

type Moves = { status: "loading" } | { status: "ok"; moves: TeamMove[] } | { status: "error"; message: string };

interface TeamMovesProps {
  rosterId: number;
  currentWeek: number;
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
}

export function TeamMoves({ rosterId, currentWeek, players, teamFor }: TeamMovesProps) {
  const [state, setState] = useState<Moves>({ status: "loading" });

  useEffect(() => {
    let live = true;
    const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
    Promise.all(weeks.map((w) => leagueTransactions(w, w === currentWeek))).then(
      (all) => live && setState({ status: "ok", moves: teamTransactions(all.flat(), rosterId) }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [rosterId, currentWeek]);

  if (state.status === "loading") return <p role="status">Loading transactions...</p>;
  if (state.status === "error") return <p role="alert">Could not load transactions ({state.message}).</p>;
  if (state.moves.length === 0) return <p>No adds, drops or trades yet.</p>;

  const player = (id: string) => <DrillLink to={{ kind: "player", playerId: id }}>{players[id]?.name ?? id}</DrillLink>;
  const pick = (p: Pick) => `${p.season} round ${p.round}${p.original === rosterId ? "" : ` (${teamFor(p.original).name})`}`;
  const list = (ids: string[], picks: Pick[]) =>
    ids.length + picks.length === 0 ? (
      "-"
    ) : (
      <ul className="flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id}>{player(id)}</li>
        ))}
        {picks.map((p) => (
          <li key={`${p.season}-${p.round}-${p.original}`}>{pick(p)}</li>
        ))}
      </ul>
    );

  return (
    <div className="xp-table-scroll">
      <table className="xp-table">
        <caption className="sr-only">Transactions</caption>
        <thead>
          <tr>
            <th scope="col" className="w-18">Week</th>
            <th scope="col" className="w-32">Type</th>
            <th scope="col">Added</th>
            <th scope="col">Dropped</th>
          </tr>
        </thead>
        <tbody>
          {state.moves.map((m) => (
            <tr key={m.id}>
              <td>Week {m.week}</td>
              <td>
                {TYPES[m.type]}
                {m.partners.map((id, i) => (
                  <Fragment key={id}>
                    {i === 0 ? " with " : ", "}
                    <DrillLink to={{ kind: "team", rosterId: id }}>{teamFor(id).name}</DrillLink>
                  </Fragment>
                ))}
              </td>
              <td>{list(m.added, m.picksIn)}</td>
              <td>{list(m.dropped, m.picksOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
