"use client";

import { DrillLink } from "@/components/views/drill-link";
import { LedgerWeek } from "@/components/views/ledger-week";
import { WeekIces } from "@/components/views/week-ices";
import { IceBadge } from "@/components/xp/IceBadge";
import { WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerSummary } from "@/lib/api/ledger";
import type { RosterTally } from "@/lib/ices/tally";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { byRoster } from "@/lib/league/drill";
import { type Team, useLeague } from "@/lib/league/use-league";

interface BoardProps {
  owed: RosterTally[];
  teamFor: (rosterId: number) => Team;
}

function ProvisionalBoard({ owed, teamFor }: BoardProps) {
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
              {t.total > 0 ? <IceBadge count={t.total} /> : <span className="tabular-nums">0</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const NUMBERS = [
  { key: "owed", label: "Owed" },
  { key: "completed", label: "Completed" },
  { key: "late", label: "Late" },
  { key: "overdue", label: "Overdue" },
] as const;

interface SummaryProps {
  rows: LedgerSummary[];
  teamFor: (rosterId: number) => Team;
}

function SeasonSummary({ rows, teamFor }: SummaryProps) {
  const outstanding = (s: LedgerSummary) => s.owed + s.lateOwed;
  const sorted = [...rows].sort((a, b) => outstanding(b) - outstanding(a) || b.late - a.late || a.rosterId - b.rosterId);
  return (
    <table className="xp-table">
      <caption className="mb-2 text-left text-sm font-bold">Season summary</caption>
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
            <td className="md:max-w-0">
              <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
                <TeamName name={teamFor(s.rosterId).name} iced={outstanding(s) > 0} ices={0} />
              </DrillLink>
            </td>
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

function LateLeaders({ rows, teamFor }: SummaryProps) {
  const late = rows.filter((s) => s.late > 0).sort((a, b) => b.late - a.late || a.rosterId - b.rosterId);
  return (
    <section className="xp-group" aria-label="Late Ices">
      <h3 className="xp-group-title">Late Ices</h3>
      {late.length === 0 ? (
        <p>No late ices yet.</p>
      ) : (
        <ol className="grid gap-1">
          {late.map((s) => (
            <li key={s.rosterId} className="flex items-center justify-between gap-2">
              <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
                <TeamName name={teamFor(s.rosterId).name} iced={s.lateOwed > 0} ices={0} />
              </DrillLink>
              <span className="font-bold tabular-nums">{s.late}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Every roster gets a row, including the ones the ledger has never iced.
const summaryFor = (ledger: Ledger, rosterIds: number[]): LedgerSummary[] =>
  rosterIds.map(
    (rosterId) =>
      ledger.summary.find((s) => s.rosterId === rosterId) ?? { rosterId, owed: 0, completed: 0, late: 0, lateOwed: 0, overdue: 0 },
  );

export function IcesWindow() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const ledgerState = useLedger();
  const error = leagueError ?? icesError;

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !currentWeek || ledgerState.status === "loading") return <p role="status">Tallying the ices...</p>;

  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const finalized = new Set(ledger?.weeks.filter((w) => w.finalizedAt).map((w) => w.week));
  const summary = ledger && summaryFor(ledger, tally.owed.map((t) => t.rosterId));
  const weeks = Array.from({ length: currentWeek }, (_, i) => currentWeek - i);

  return (
    <div className="grid gap-3">
      {summary ? (
        <>
          <div>
            <div className="xp-table-scroll">
              <SeasonSummary rows={summary} teamFor={teamFor} />
            </div>
            <p className="xp-note mt-2">
              Owed and completed count weekly ices. Late counts late ices; overdue is owed past its week&apos;s deadline.
            </p>
          </div>
          <LateLeaders rows={summary} teamFor={teamFor} />
        </>
      ) : (
        <div>
          <div className="xp-table-scroll">
            <ProvisionalBoard owed={tally.owed} teamFor={teamFor} />
          </div>
          <p role="note" className="xp-note mt-2 flex items-center gap-1">
            <WarningIcon className="shrink-0" />
            Ledger unavailable ({ledgerState.status === "error" && ledgerState.message}). Showing owed ices from Sleeper scores.
          </p>
        </div>
      )}

      {weeks.map((week) => {
        if (ledger && finalized.has(week)) {
          return (
            <section key={week} className="xp-group" aria-label={`Week ${week}`}>
              <h3 className="xp-group-title">Week {week}</h3>
              <LedgerWeek ices={ledger.ices.filter((i) => i.week === week)} players={data.players} teamFor={teamFor} />
            </section>
          );
        }
        const live = week === currentWeek;
        const label = live ? `Week ${week} — live, provisional` : `Week ${week} — provisional`;
        const ices = (live ? tally.live : tally.weeks.find((w) => w.week === week))?.ices ?? [];
        return (
          <section key={week} className="xp-group" aria-label={label}>
            <h3 className="xp-group-title">{label}</h3>
            {live && <p className="xp-note">Zeros and the lowest score lock in when the week ends. Only empty slots count now.</p>}
            {ices.length === 0 ? (
              <p>{live ? "No empty slots this week." : "No ices this week."}</p>
            ) : (
              <WeekIces groups={byRoster(ices)} players={data.players} teamFor={teamFor} />
            )}
          </section>
        );
      })}
    </div>
  );
}
