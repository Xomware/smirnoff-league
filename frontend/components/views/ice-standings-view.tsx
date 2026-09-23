"use client";

import { type ReactNode, useMemo, useState } from "react";

import { IceBadge } from "@/components/xp/IceBadge";
import { TeamName } from "@/components/xp/TeamName";
import { DEFAULT_SORT, iceStandings, seasonGrid, type Sort, type SortKey, sortRows, toggleSort } from "@/lib/ices/standings";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { DrillLink } from "./drill-link";

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "rank", label: "#", className: "w-10" },
  { key: "team", label: "Team", className: "w-48" },
  { key: "total", label: "Ices", className: "w-14 text-right" },
  { key: "completed", label: "Completed", className: "w-24 text-right" },
  { key: "late", label: "Late", className: "w-14 text-right" },
  { key: "zero", label: "Zero", className: "w-14 text-right" },
  { key: "empty", label: "Empty", className: "w-16 text-right" },
  { key: "lowest", label: "Lowest", className: "w-18 text-right" },
  { key: "streak", label: "Streak", className: "w-18 text-right" },
  { key: "worst", label: "Worst", className: "w-20 text-right" },
];

interface SortHeaderProps {
  sort: Sort;
  column: (typeof COLUMNS)[number];
  onSort: (key: SortKey) => void;
}

function SortHeader({ sort, column, onSort }: SortHeaderProps) {
  const active = sort.key === column.key;
  return (
    <th
      scope="col"
      className={column.className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button type="button" className="xp-sort" onClick={() => onSort(column.key)}>
        {column.label}
        <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden focusable="false" className={active ? "" : "invisible"}>
          <path d={sort.dir === "asc" ? "M4 1l3 5H1z" : "M4 7L1 2h6z"} className="fill-current" />
        </svg>
      </button>
    </th>
  );
}

const heat = (count: number) => `ice-heat-${Math.min(count, 4)}`;

export function IceStandingsView() {
  const { data, error: leagueError, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, finishedWeeks, error: icesError } = useSeasonIces(currentWeek);
  const ledger = useLedger();
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const error = leagueError ?? icesError;

  const standings = useMemo(() => {
    if (!data || !tally || !finishedWeeks || ledger.status === "loading") return null;
    const pf = Object.fromEntries(sortStandings(data.rosters).map((s) => [s.rosterId, s.pf]));
    return iceStandings(tally, finishedWeeks, pf, ledger.status === "ok" ? ledger.ledger.summary : null);
  }, [data, tally, finishedWeeks, ledger]);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!standings || !tally) return <p role="status">Ranking the shame...</p>;

  const rows = sortRows(standings, sort, (id) => teamFor(id).name);
  const grid = seasonGrid(
    rows.map((r) => r.rosterId),
    tally,
  );
  const mine = (rosterId: number) => (rosterId === myRosterId ? "xp-mine" : undefined);
  const cell = (children: ReactNode) => <td className="text-right tabular-nums">{children}</td>;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="xp-table min-w-[46rem]">
          <caption className="mb-2 text-left text-sm font-bold">Ice Standings — owed, provisional</caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <SortHeader key={column.key} sort={sort} column={column} onSort={(key) => setSort(toggleSort(sort, key))} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rosterId} className={mine(r.rosterId)}>
                <td className="tabular-nums">{r.rank}</td>
                <td className="max-w-0">
                  <DrillLink to={{ kind: "team", rosterId: r.rosterId }}>
                    <TeamName name={teamFor(r.rosterId).name} iced={r.total > 0} ices={0} isMine={r.rosterId === myRosterId} />
                  </DrillLink>
                </td>
                {cell(r.total)}
                {cell(r.completed ?? "—")}
                {cell(r.late ?? "—")}
                {cell(r.reasons.zero)}
                {cell(r.reasons.empty)}
                {cell(r.reasons.lowest)}
                {cell(r.streak)}
                {cell(r.worst ? `W${r.worst.week} (${r.worst.count})` : "—")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="xp-table ice-grid">
          <caption className="mb-2 text-left text-sm font-bold">Season grid</caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              {grid.columns.map(({ week, live }) => (
                <th key={week} scope="col" className="text-center">
                  {live ? `Wk ${week} (live)` : `Wk ${week}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map(({ rosterId, counts }) => (
              <tr key={rosterId} className={mine(rosterId)}>
                <th scope="row">{teamFor(rosterId).name}</th>
                {counts.map((count, i) => {
                  const { week } = grid.columns[i];
                  return (
                    <td key={week} className={heat(count)}>
                      <DrillLink to={{ kind: "week", week }}>
                        <span className="sr-only">Week {week}: </span>
                        {count > 0 ? <IceBadge count={count} /> : <span className="tabular-nums">0</span>}
                      </DrillLink>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {grid.totals.map((total, i) => (
                <td key={grid.columns[i].week} className="text-center tabular-nums">
                  {total}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="xp-note">
        Owed from Sleeper scores. The live week counts only empty slots until it ends; zeros and the lowest score lock in then. Completed and Late come from the ledger.
      </p>
    </div>
  );
}
