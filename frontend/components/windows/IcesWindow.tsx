"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { canTime, ChugTimeButton, ChugTimeDialog } from "@/components/videos/ChugTime";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { DrillLink } from "@/components/views/drill-link";
import { LedgerStats } from "@/components/views/ledger-stats";
import { LedgerWeek } from "@/components/views/ledger-week";
import { WeekIces } from "@/components/views/week-ices";
import { WhoOwes } from "@/components/views/who-owes";
import { IceBadge } from "@/components/xp/IceBadge";
import { WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerIce, LedgerSummary } from "@/lib/api/ledger";
import type { RosterTally } from "@/lib/ices/tally";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { byRoster } from "@/lib/league/drill";
import { type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

import "./ledger.css";

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
              {t.total > 0 ? <IceBadge count={t.total} season /> : <span className="tabular-nums">0</span>}
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

// Every roster gets a row, including the ones the ledger has never iced.
const summaryFor = (ledger: Ledger, rosterIds: number[]): LedgerSummary[] =>
  rosterIds.map(
    (rosterId) =>
      ledger.summary.find((s) => s.rosterId === rosterId) ?? { rosterId, owed: 0, completed: 0, late: 0, lateOwed: 0, overdue: 0 },
  );

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

function weekLine(week: number, ices: LedgerIce[]): string {
  const originals = ices.filter((i) => i.reason !== "late");
  const done = originals.filter((i) => i.status === "completed").length;
  return `Week ${week} · ${plural(originals.length, "ice")} · ${done} done · ${ices.length - originals.length} late`;
}

interface IceLedgerProps {
  // The phone folds the season summary away; Ice standings already ranks the season there.
  phone?: boolean;
}

export function IceLedger({ phone = false }: IceLedgerProps) {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const ledgerState = useLedger();
  const { myRosterId, me } = useProfile();
  const [upload, setUpload] = useState<string[] | null>(null);
  const [timing, setTiming] = useState<LedgerIce | null>(null);
  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const now = useNow(ledger?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);
  const error = leagueError ?? icesError;

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !currentWeek || ledgerState.status === "loading") return <p role="status">Tallying the ices...</p>;

  const finalized = new Set(ledger?.weeks.filter((w) => w.finalizedAt).map((w) => w.week));
  const summary = ledger && summaryFor(ledger, tally.owed.map((t) => t.rosterId));
  const past = Array.from({ length: currentWeek - 1 }, (_, i) => currentWeek - 1 - i);
  const isAdmin = me?.isAdmin ?? false;
  const rowAction = (ice: LedgerIce) => {
    if (ice.status === "owed" && canUpload(ice, myRosterId, isAdmin)) return <UploadChugButton onClick={() => setUpload([ice.iceId])} />;
    if (canTime(ice, myRosterId, isAdmin)) return <ChugTimeButton ice={ice} onClick={() => setTiming(ice)} />;
  };

  const ledgerWeek = (week: number) => (
    <LedgerWeek ices={ledger!.ices.filter((i) => i.week === week)} players={data.players} teamFor={teamFor} action={rowAction} />
  );
  const provisional = (week: number, live: boolean) => {
    const ices = (live ? tally.live : tally.weeks.find((w) => w.week === week))?.ices ?? [];
    if (ices.length === 0) return <p>{live ? "No empty slots this week." : "No ices this week."}</p>;
    return <WeekIces groups={byRoster(ices)} players={data.players} teamFor={teamFor} />;
  };

  const liveLabel = `Week ${currentWeek} — live, provisional`;
  const liveFinal = ledger && finalized.has(currentWeek);

  return (
    <div className="grid grid-cols-1 gap-3">
      {ledger ? (
        <>
          <LedgerStats ledger={ledger} now={now} teamFor={teamFor} />
          <WhoOwes ledger={ledger} now={now} players={data.players} teamFor={teamFor} myRosterId={myRosterId} onUpload={setUpload} />
        </>
      ) : (
        <div className="ices-summary">
          <div className="xp-table-scroll">
            <ProvisionalBoard owed={tally.owed} teamFor={teamFor} />
          </div>
          <p role="note" className="xp-note mt-2 flex items-center gap-1">
            <WarningIcon className="shrink-0" />
            Ledger unavailable ({ledgerState.status === "error" && ledgerState.message}). Showing owed ices from Sleeper scores.
          </p>
        </div>
      )}

      <section className="xp-group" aria-label={liveFinal ? `Week ${currentWeek}` : liveLabel}>
        <h3 className="xp-group-title">{liveFinal ? `Week ${currentWeek}` : liveLabel}</h3>
        {liveFinal ? (
          ledgerWeek(currentWeek)
        ) : (
          <>
            <p className="xp-note">Zeros and the lowest score lock in when the week ends. Only empty slots count now.</p>
            {provisional(currentWeek, true)}
          </>
        )}
      </section>

      {past.map((week, i) => {
        const final = ledger && finalized.has(week);
        const line = final
          ? weekLine(week, ledger.ices.filter((ice) => ice.week === week))
          : `Week ${week} · ${plural(tally.weeks.find((w) => w.week === week)?.ices.length ?? 0, "ice")} · provisional`;
        return (
          <details key={week} className="xp-group ledger-week" open={i === 0}>
            <summary className="xp-group-title">{line}</summary>
            {final ? ledgerWeek(week) : provisional(week, false)}
          </details>
        );
      })}

      {summary && (
        <details className="ices-summary" open={!phone}>
          <summary className="xp-group-title">Season summary</summary>
          <div className="xp-table-scroll">
            <SeasonSummary rows={summary} teamFor={teamFor} />
          </div>
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

export const IcesWindow = () => <IceLedger />;
