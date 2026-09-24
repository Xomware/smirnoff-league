"use client";

import { type CSSProperties, type ReactNode, useId, useMemo, useState } from "react";

import { chugTime } from "@/components/videos/ChugTime";
import {
  barWidth,
  chuggerRankings,
  chugsFrom,
  chugWeeks,
  rankLabel,
  type Ranked,
  rankSpoken,
  type Sort,
  type SortKey,
  sortRankings,
  summaryCards,
  weekRankings,
} from "@/lib/ices/chug-rankings";
import { useLedger } from "@/lib/ices/use-ledger";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { BoardHead } from "./board";
import { DrillLink } from "./drill-link";

import "./chug-rankings.css";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "rank", label: "RK", className: "w-20" },
  { key: "chugger", label: "Chugger" },
  { key: "team", label: "Team" },
  { key: "pr", label: "PR", className: "w-18 text-right" },
  { key: "avg", label: "AVG", className: "w-18 text-right" },
  { key: "count", label: "Chugs", className: "w-18 text-right" },
];

// Chug counts read best biggest-first; everything else starts smallest-first.
const firstDir = (key: SortKey): Sort["dir"] => (key === "count" ? "desc" : "asc");

function RankCell({ row }: { row: Ranked }) {
  const spoken = rankSpoken(row);
  return (
    <span className={row.rank === 1 ? "rank-label rank-top" : "rank-label"}>
      {spoken ? (
        <>
          <span aria-hidden="true">{rankLabel(row)}</span>
          <span className="sr-only">{spoken}</span>
        </>
      ) : (
        rankLabel(row)
      )}
    </span>
  );
}

function Bar({ width, top }: { width: number; top: boolean }) {
  return <span aria-hidden="true" className={top ? "board-bar board-bar-top" : "board-bar"} style={{ "--bar": `${width}%` } as CSSProperties} />;
}


function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="xp-dialog" aria-label={title}>
      <h3 className="xp-dialog-title">{title}</h3>
      <div className="rank-card-body">{children}</div>
    </section>
  );
}

export function ChugRankingsView() {
  const ledger = useLedger();
  const { teamFor } = useLeague();
  const { me } = useProfile();
  const [sort, setSort] = useState<Sort>({ key: "rank", dir: "asc" });
  const [picked, setPicked] = useState<number | null>(null);
  const weekTitle = useId();

  const chugs = useMemo(() => (ledger.status === "ok" ? chugsFrom(ledger.ledger.ices) : []), [ledger]);
  const rows = useMemo(() => chuggerRankings(chugs), [chugs]);

  if (ledger.status === "loading") return <p role="status">Timing the chugs...</p>;
  if (ledger.status === "error") return <p role="alert">Could not load the ledger ({ledger.message}). Refresh to try again.</p>;

  const team = (rosterId: number) => teamFor(rosterId).name;
  const who = (c: { name: string | null; rosterId: number }) => c.name ?? team(c.rosterId);
  const mine = (c: { name: string | null }) => (c.name !== null && c.name === me?.profile?.name ? "xp-mine" : undefined);
  const teamLink = (rosterId: number) => <DrillLink to={{ kind: "team", rosterId }}>{team(rosterId)}</DrillLink>;
  const weeks = chugWeeks(chugs);
  const week = picked !== null && weeks.includes(picked) ? picked : weeks[weeks.length - 1];
  const weekly = week === undefined ? [] : weekRankings(chugs, week);
  const sorted = sortRankings(rows, sort, who, team);
  const cards = summaryCards(chugs, rows);
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir(key) }));

  const prs = rows.map((r) => r.pr);
  const prBar = (r: Ranked & { pr: number }) => <Bar width={barWidth(r.pr, Math.min(...prs), Math.max(...prs))} top={r.rank === 1} />;
  const times = weekly.map((c) => c.seconds);
  const timeBar = (c: Ranked & { seconds: number }) => (
    <Bar width={barWidth(c.seconds, Math.min(...times), Math.max(...times))} top={c.rank === 1} />
  );

  // A chugger nobody named goes by their team, so the team line would only repeat it.
  const boardRow = (key: string, row: Ranked & { name: string | null; rosterId: number }, bar: ReactNode, nums: ReactNode) => (
    <li key={key} className={`board-row ${mine(row) ?? ""}`}>
      <RankCell row={row} />
      <span className="board-who">
        <span className="board-name">{row.name ?? teamLink(row.rosterId)}</span>
        {row.name !== null && row.name !== team(row.rosterId) && <span className="board-sub">{teamLink(row.rosterId)}</span>}
        {bar}
      </span>
      {nums}
    </li>
  );

  return (
    <div className="chug-rankings">
      <header>
        <h2 className="rank-title">Ice Rankings</h2>
        <p>Every ice chug time on record, ranked by personal best.</p>
      </header>

      {chugs.length === 0 ? (
        <p className="xp-inset p-3">No chug times yet. Upload a chug and log how long it took to get on the board.</p>
      ) : (
        <>
          <section aria-label="Overall" className="grid gap-2">
            <div className="rank-wide">
              <table className="xp-table">
                <caption className="sr-only">Chuggers ranked by personal best</caption>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={c.className}
                        aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        <button type="button" className="xp-sort" onClick={() => onSort(c.key)}>
                          {c.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.key} className={mine(r)}>
                      <td>
                        <RankCell row={r} />
                      </td>
                      <td className="font-bold">
                        {who(r)}
                        <span className="block max-w-48">{prBar(r)}</span>
                      </td>
                      <td>{teamLink(r.rosterId)}</td>
                      <td className="text-right tabular-nums">{chugTime(r.pr)}</td>
                      <td className="text-right tabular-nums">{chugTime(r.avg)}</td>
                      <td className="text-right tabular-nums">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="board rank-cards rank-board">
              <BoardHead labels={["RK", "Chugger", "PR", "AVG", "#"]} />
              <ol aria-label="Chuggers ranked by personal best">
                {sorted.map((r) =>
                  boardRow(
                    r.key,
                    r,
                    prBar(r),
                    <>
                      <span className="board-num">
                        <span className="sr-only">PR </span>
                        {chugTime(r.pr)}
                      </span>
                      <span className="board-num">
                        <span className="sr-only">average </span>
                        {chugTime(r.avg)}
                      </span>
                      <span className="board-num">
                        {r.count}
                        <span className="sr-only">{r.count === 1 ? " chug" : " chugs"}</span>
                      </span>
                    </>,
                  ),
                )}
              </ol>
            </div>
          </section>

          <section aria-labelledby={weekTitle} className="grid gap-2">
            <h3 id={weekTitle} className="rank-subtitle">
              Ranked by week
            </h3>
            <div className="rank-chips" role="group" aria-label="Week">
              {weeks.map((w) => (
                <button key={w} type="button" className="rank-chip" aria-pressed={w === week} onClick={() => setPicked(w)}>
                  Week {w}
                </button>
              ))}
            </div>
            <div className="rank-wide">
              <table className="xp-table">
                <caption className="sr-only">Week {week} chugs ranked by time</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-20">
                      RK
                    </th>
                    <th scope="col">Chugger</th>
                    <th scope="col">Team</th>
                    <th scope="col" className="w-20 text-right">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((c) => (
                    <tr key={c.iceId} className={mine(c)}>
                      <td>
                        <RankCell row={c} />
                      </td>
                      <td className="font-bold">
                        {who(c)}
                        <span className="block max-w-48">{timeBar(c)}</span>
                      </td>
                      <td>{teamLink(c.rosterId)}</td>
                      <td className="text-right tabular-nums">{chugTime(c.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="board rank-cards rank-board-week">
              <BoardHead labels={["RK", "Chugger", "Time"]} />
              <ol aria-label={`Week ${week} chugs ranked by time`}>
                {weekly.map((c) => boardRow(c.iceId, c, timeBar(c), <span className="board-num">{chugTime(c.seconds)}</span>))}
              </ol>
            </div>
          </section>

          <div className="rank-summary">
            <Card title="Fastest ever">
              {cards.fastest && (
                <>
                  <strong className="rank-big">{chugTime(cards.fastest.seconds)}</strong>
                  <span>
                    {who(cards.fastest)}, Week {cards.fastest.week}
                  </span>
                </>
              )}
            </Card>
            <Card title="League average">
              <strong className="rank-big">{cards.average === null ? "-" : chugTime(cards.average)}</strong>
              <span>
                over {cards.count} {cards.count === 1 ? "chug" : "chugs"}
              </span>
            </Card>
            <Card title="Most improved">
              {cards.improved ? (
                <>
                  <strong className="rank-big">-{chugTime(cards.improved.drop)}</strong>
                  <span>
                    {who(cards.improved.row)}, {chugTime(cards.improved.first)} to {chugTime(cards.improved.latest)}
                  </span>
                </>
              ) : (
                <span>Nobody has gotten faster over two chugs yet.</span>
              )}
            </Card>
            <Card title="Slowest average">
              {cards.slowest && (
                <>
                  <strong className="rank-big">{chugTime(cards.slowest.avg)}</strong>
                  <span>{who(cards.slowest)}</span>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
