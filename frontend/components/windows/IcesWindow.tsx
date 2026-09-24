"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { FilterBar, FilterEmpty } from "@/components/filters/FilterBar";
import { canTime, ChugTimeButton, ChugTimeDialog } from "@/components/videos/ChugTime";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { DrillLink } from "@/components/views/drill-link";
import { LedgerWeek } from "@/components/views/ledger-week";
import { WeekIces } from "@/components/views/week-ices";
import { IceBadge } from "@/components/xp/IceBadge";
import { WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerIce, LedgerSummary } from "@/lib/api/ledger";
import type { WindowParams } from "@/lib/desktop/windows";
import { defaultFilters, type FilterField, type FilterValues, plural, readFilters, useFilterParam, writeFilters } from "@/lib/filters/filters";
import type { RosterTally } from "@/lib/ices/tally";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { byRoster } from "@/lib/league/drill";
import { type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

import "./ledger.css";

interface BoardProps {
  owed: RosterTally[];
  teamFor: (rosterId: number) => Team;
}

export function ProvisionalBoard({ owed, teamFor }: BoardProps) {
  return (
    <table className="xp-table">
      <caption className="mb-2 text-left text-sm font-bold">Owed — provisional</caption>
      <thead>
        <tr>
          <th scope="col" className="w-12">#</th>
          <th scope="col">Team</th>
          <th scope="col" className="w-18 text-right">Owed</th>
        </tr>
      </thead>
      <tbody>
        {owed.map((t, i) => (
          <tr key={t.rosterId}>
            <td>{i + 1}</td>
            <td className="md:max-w-0">
              <DrillLink to={{ kind: "team", rosterId: t.rosterId }}>
                <TeamName name={teamFor(t.rosterId).name} iced={t.total > 0} ices={0} />
              </DrillLink>
            </td>
            <td className="text-right">
              {t.total > 0 ? <IceBadge count={t.total} season /> : <span className="tabular-nums">0</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const NUMBERS = [
  { key: "owed", label: "Owed", short: "Owed" },
  { key: "completed", label: "Completed", short: "Done" },
  { key: "late", label: "Late", short: "Late" },
  { key: "overdue", label: "Overdue", short: "Overdue" },
] as const;

interface SummaryProps {
  rows: LedgerSummary[];
  teamFor: (rosterId: number) => Team;
  // A row per team with its four counts under the name, so nothing scrolls sideways.
  stacked?: boolean;
}

function SeasonSummary({ rows, teamFor, stacked = false }: SummaryProps) {
  const outstanding = (s: LedgerSummary) => s.owed + s.lateOwed;
  const sorted = [...rows].sort((a, b) => outstanding(b) - outstanding(a) || b.late - a.late || a.rosterId - b.rosterId);
  const team = (s: LedgerSummary) => (
    <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
      <TeamName name={teamFor(s.rosterId).name} iced={outstanding(s) > 0} ices={0} />
    </DrillLink>
  );
  if (stacked)
    return (
      <ol aria-label="Season summary" className="summary-rows">
        {sorted.map((s, i) => (
          <li key={s.rosterId} className="summary-row">
            <span className="ov-rank">{i + 1}</span>
            {team(s)}
            <dl className="summary-stats">
              {NUMBERS.map(({ key, short }) => (
                <div key={key}>
                  <dt>{short}</dt>
                  <dd>{s[key]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    );
  return (
    <table className="xp-table">
      <caption className="sr-only">Season summary</caption>
      <thead>
        <tr>
          <th scope="col" className="w-10">#</th>
          <th scope="col">Team</th>
          {NUMBERS.map(({ key, label }) => (
            <th key={key} scope="col" className="w-18 text-right">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((s, i) => (
          <tr key={s.rosterId}>
            <td>{i + 1}</td>
            <td className="md:max-w-0">{team(s)}</td>
            {NUMBERS.map(({ key }) => (
              <td key={key} className="text-right tabular-nums">
                {s[key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Every roster gets a row, including the ones the ledger has never iced.
const summaryFor = (ledger: Ledger, rosterIds: number[]): LedgerSummary[] =>
  rosterIds.map(
    (rosterId) =>
      ledger.summary.find((s) => s.rosterId === rosterId) ?? { rosterId, owed: 0, completed: 0, late: 0, lateOwed: 0, overdue: 0 },
  );

function weekLine(week: number, ices: LedgerIce[]): string {
  const originals = ices.filter((i) => i.reason !== "late");
  const done = originals.filter((i) => i.status === "completed").length;
  return `Week ${week} · ${plural(originals.length, "ice")} · ${done} done · ${ices.length - originals.length} late`;
}

const STATUSES: Record<string, { label: string; keep: (ice: LedgerIce) => boolean }> = {
  all: { label: "All", keep: () => true },
  owed: { label: "Owed", keep: (i) => i.status === "owed" },
  late: { label: "Late", keep: (i) => i.reason === "late" },
  paid: { label: "Paid", keep: (i) => i.status === "completed" },
};

interface IceLedgerProps {
  params?: WindowParams;
  // The phone folds the season summary away; Ice standings already ranks the season there.
  phone?: boolean;
}

export function IceLedger({ params = {}, phone = false }: IceLedgerProps) {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const ledgerState = useLedger();
  const { myRosterId, me } = useProfile();
  const [param, setParam] = useFilterParam(params);
  const [upload, setUpload] = useState<string[] | null>(null);
  const [timing, setTiming] = useState<LedgerIce | null>(null);
  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const error = leagueError ?? icesError;

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !currentWeek || ledgerState.status === "loading") return <p role="status">Tallying the ices...</p>;

  const rosterIds = tally.owed.map((t) => t.rosterId);
  const fields: FilterField[] = [
    {
      key: "team",
      label: "Team",
      options: [
        { value: "all", label: "All" },
        ...[...rosterIds].sort((a, b) => teamFor(a).name.localeCompare(teamFor(b).name)).map((r) => ({ value: String(r), label: teamFor(r).name })),
      ],
    },
    { key: "status", label: "Status", options: Object.entries(STATUSES).map(([value, { label }]) => ({ value, label })) },
  ];
  const f = readFilters(fields, param);
  const set = (values: FilterValues) => setParam(writeFilters(fields, values));
  const filtered = writeFilters(fields, f) !== "";
  const onTeam = (ice: { rosterId: number }) => f.team === "all" || ice.rosterId === Number(f.team);

  const finalized = new Set(ledger?.weeks.filter((w) => w.finalizedAt).map((w) => w.week));
  const summary = ledger && summaryFor(ledger, rosterIds).filter(onTeam);
  const isAdmin = me?.isAdmin ?? false;
  const rowAction = (ice: LedgerIce) => {
    if (ice.status === "owed" && canUpload(ice, myRosterId, isAdmin)) return <UploadChugButton onClick={() => setUpload([ice.iceId])} />;
    if (canTime(ice, myRosterId, isAdmin)) return <ChugTimeButton ice={ice} onClick={() => setTiming(ice)} />;
  };

  // Newest first. Sleeper's provisional ices have no status yet, so a status filter hides them.
  const weeks = Array.from({ length: currentWeek }, (_, i) => currentWeek - i)
    .map((week) => {
      const live = week === currentWeek;
      if (ledger && finalized.has(week)) {
        const ices = ledger.ices.filter((i) => i.week === week && onTeam(i) && STATUSES[f.status].keep(i));
        return {
          week,
          count: ices.length,
          line: weekLine(week, ices),
          body: <LedgerWeek ices={ices} players={data.players} teamFor={teamFor} action={rowAction} />,
        };
      }
      const all = (live ? tally.live : tally.weeks.find((w) => w.week === week))?.ices ?? [];
      const ices = f.status === "all" ? all.filter(onTeam) : [];
      const list =
        ices.length === 0 ? (
          <p>{live ? "No ices locked yet." : "No ices this week."}</p>
        ) : (
          <WeekIces groups={byRoster(ices)} players={data.players} teamFor={teamFor} />
        );
      return {
        week,
        count: ices.length,
        line: live ? `Week ${week} — live, provisional` : `Week ${week} · ${plural(ices.length, "ice")} · provisional`,
        body: live ? (
          <>
            <p className="xp-note">Zeros and the lowest score lock in when the week ends. Empty slots count once every game has kicked off.</p>
            {list}
          </>
        ) : (
          list
        ),
      };
    })
    .filter((w) => !filtered || w.count > 0);

  return (
    <div className="grid grid-cols-1 gap-3">
      <FilterBar fields={fields} values={f} count={plural(weeks.reduce((n, w) => n + w.count, 0), "ice")} onChange={set} />
      {!ledger && (
        <p role="note" className="xp-note flex items-center gap-1">
          <WarningIcon className="shrink-0" />
          Ledger unavailable ({ledgerState.status === "error" && ledgerState.message}). Showing ices from Sleeper scores.
        </p>
      )}

      {weeks.map(({ week, line, body }) => (
        // Filtering opens every week left, so the matching rows show.
        <details key={week} className="xp-group ledger-week" open={week === currentWeek || filtered}>
          <summary className="xp-group-title">{line}</summary>
          {body}
        </details>
      ))}
      {filtered && weeks.length === 0 && <FilterEmpty onClear={() => set(defaultFilters(fields))}>No ices match these filters.</FilterEmpty>}

      {summary && (
        <details className="ices-summary" open={!phone}>
          <summary className="xp-group-title">Season summary</summary>
          {phone ? (
            <SeasonSummary rows={summary} teamFor={teamFor} stacked />
          ) : (
            <div className="xp-table-scroll">
              <SeasonSummary rows={summary} teamFor={teamFor} />
            </div>
          )}
          <p className="xp-note mt-2">
            Owed and completed count weekly ices. Late counts late ices; overdue is owed past its week&apos;s deadline.
          </p>
        </details>
      )}
      {ledger && upload && createPortal(<UploadChug ices={ledger.ices} initialIceIds={upload} onClose={() => setUpload(null)} />, document.body)}
      {timing && <ChugTimeDialog ice={timing} label={iceLabel(timing, teamFor, data.players)} onClose={() => setTiming(null)} />}
    </div>
  );
}

export const IcesWindow = ({ params }: { params?: WindowParams }) => <IceLedger params={params} />;
