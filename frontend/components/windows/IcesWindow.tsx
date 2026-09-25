"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { canTime, ChugTimeButton, ChugTimeDialog } from "@/components/videos/ChugTime";
import { iceLabel } from "@/components/videos/ice-label";
import { canUpload, UploadChug, UploadChugButton } from "@/components/videos/UploadChug";
import { BoardHead } from "@/components/views/board";
import { DrillLink } from "@/components/views/drill-link";
import { OweRows } from "@/components/views/ledger-owes";
import { LedgerWeek } from "@/components/views/ledger-week";
import { WeekIces } from "@/components/views/week-ices";
import { IceBadge } from "@/components/xp/IceBadge";
import { WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerIce, LedgerSummary } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { WindowParams } from "@/lib/desktop/windows";
import { type FilterField, plural, readFilters, useFilterParam, writeFilters } from "@/lib/filters/filters";
import { dueWeek, etDay, etDeadline, lateNow, owedGroups, rowOrder } from "@/lib/ices/ledger-weeks";
import type { RosterTally } from "@/lib/ices/tally";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { byRoster } from "@/lib/league/drill";
import { type Team, useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { useMediaQuery } from "@/lib/use-media-query";
import { useVideos } from "@/lib/videos/use-videos";

import "@/components/views/chug-rankings.css";
import "./ledger.css";

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
  // A chart row per team with narrow count columns, so nothing scrolls sideways.
  stacked?: boolean;
}

function SeasonSummary({ rows, teamFor, stacked = false }: SummaryProps) {
  const outstanding = (s: LedgerSummary) => s.owed + s.lateOwed;
  const sorted = [...rows].sort((a, b) => outstanding(b) - outstanding(a) || b.late - a.late || a.rosterId - b.rosterId);
  const team = (s: LedgerSummary) => (
    <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
      {/* The count columns already say owed and late, and the tags would crowd the name out. */}
      <TeamName name={teamFor(s.rosterId).name} iced={outstanding(s) > 0} ices={0} badges={!stacked} />
    </DrillLink>
  );
  if (stacked)
    return (
      <div className="board summary-board">
        <BoardHead labels={["#", "Team", "Owed", "Done", "Late", "Over"]} />
        <ol aria-label="Season summary">
          {sorted.map((s, i) => (
            <li key={s.rosterId} className="board-row">
              <span className="board-rank">{i + 1}</span>
              <span className="board-who">
                <span className="board-name">{team(s)}</span>
              </span>
              {NUMBERS.map(({ key, short }) => (
                <span key={key} className="board-num">
                  {s[key]}
                  <span className="sr-only"> {short.toLowerCase()}</span>
                </span>
              ))}
            </li>
          ))}
        </ol>
      </div>
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


const STATUSES = [
  { value: "all", label: "All" },
  { value: "owed", label: "Owed" },
  { value: "late", label: "Late" },
  { value: "paid", label: "Paid" },
];

const NARROW = "(max-width: 639.98px)";

const dueLabel = (deadline: number) => `Due ${etDay(deadline)} · ${etDeadline(deadline).split(" ").slice(1).join(" ")}`;

interface IceLedgerProps {
  params?: WindowParams;
  // The phone's season summary is chart rows; Ice standings already ranks the season there.
  phone?: boolean;
}

export function IceLedger({ params = {}, phone = false }: IceLedgerProps) {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const ledgerState = useLedger();
  const { state: videoState, onVideoError } = useVideos();
  const { myRosterId, me } = useProfile();
  const narrow = useMediaQuery(NARROW);
  const [param, setParam] = useFilterParam(params);
  const [upload, setUpload] = useState<string[] | null>(null);
  const [timing, setTiming] = useState<LedgerIce | null>(null);
  const [playing, setPlaying] = useState<{ video: Video; label: string } | null>(null);
  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const now = useNow(ledger?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);
  const error = leagueError ?? icesError;

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !currentWeek || ledgerState.status === "loading") return <p role="status">Tallying the ices...</p>;

  const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
  // The first option is the default a link leaves out: the week whose ices come due next.
  const fields: FilterField[] = [
    {
      key: "week",
      label: "Week",
      options: [{ value: "due", label: "Due next" }, ...weeks.map((w) => ({ value: String(w), label: `Week ${w}` })), { value: "season", label: "Season" }],
    },
    { key: "status", label: "Status", options: STATUSES },
  ];
  const f = readFilters(fields, param);
  const set = (patch: Record<string, string>) => setParam(writeFilters(fields, { ...f, ...patch }));
  const view = f.week === "season" ? "season" : f.week === "due" ? (dueWeek(ledger, now) ?? currentWeek) : Number(f.week);

  const finalized = new Set(ledger?.weeks.filter((w) => w.finalizedAt).map((w) => w.week));
  const deadline = (week: number) => {
    const iso = ledger?.weeks.find((w) => w.week === week)?.deadlineUtc;
    return iso ? Date.parse(iso) : null;
  };
  const note = (week: number) => {
    if (!finalized.has(week)) return week === currentWeek ? "live" : "";
    const d = deadline(week);
    return d !== null && d > now ? `due ${etDeadline(d).replace(" ET", "")}` : "";
  };
  const keep = (i: LedgerIce) => {
    if (f.status === "owed") return i.status === "owed";
    if (f.status === "paid") return i.status === "completed";
    if (f.status === "late") return ledger !== null && lateNow(ledger, i, now);
    return true;
  };

  const videos = videoState.status === "ok" ? videoState.videos : [];
  const onPlay = (video: Video, label: string) => setPlaying({ video, label });
  const isAdmin = me?.isAdmin ?? false;
  const rowAction = (ice: LedgerIce) => {
    if (ice.status === "owed" && canUpload(ice, myRosterId, isAdmin)) return <UploadChugButton onClick={() => setUpload([ice.iceId])} />;
    if (canTime(ice, myRosterId, isAdmin)) return <ChugTimeButton ice={ice} onClick={() => setTiming(ice)} />;
  };
  const owes = (label: string, ices: LedgerIce[]) =>
    ledger && <OweRows label={label} ledger={ledger} ices={ices} now={now} players={data.players} teamFor={teamFor} videos={videos} onPlay={onPlay} />;

  // Sleeper's provisional ices have no status yet, so a status filter hides them.
  const record = (week: number) => {
    if (ledger && finalized.has(week)) {
      const ices = ledger.ices.filter((i) => i.week === week && keep(i));
      const body = ices.length ? <LedgerWeek ices={ices} players={data.players} teamFor={teamFor} action={rowAction} /> : <p>No ices match.</p>;
      return { week, count: ices.length, title: weekLine(week, ices), body };
    }
    const live = week === currentWeek;
    const all = (live ? tally.live : tally.weeks.find((w) => w.week === week))?.ices ?? [];
    const ices = f.status === "all" ? all : [];
    const list =
      ices.length === 0 ? (
        <p>{f.status !== "all" ? "No ices match." : live ? "No ices locked yet." : "No ices this week."}</p>
      ) : (
        <WeekIces groups={byRoster(ices)} players={data.players} teamFor={teamFor} />
      );
    return {
      week,
      count: ices.length,
      title: live ? `Week ${week} — live, provisional` : `Week ${week} · ${plural(ices.length, "ice")} · provisional`,
      body: live ? (
        <>
          <p className="xp-note">Zeros and the lowest score lock in when the week ends. Empty slots count once every game has kicked off.</p>
          {list}
        </>
      ) : (
        list
      ),
    };
  };
  const recordSection = ({ week, title, body }: ReturnType<typeof record>, compact = false) => (
    <section key={week} aria-label={title} className={`xp-group ledger-record${compact ? " ledger-compact" : ""}`}>
      <h3 className="xp-group-title">{title}</h3>
      {body}
    </section>
  );

  const picker = narrow ? (
    <label className="ledger-pick">
      <span>Showing</span>
      <select className="xp-select" value={String(view)} onChange={(e) => set({ week: e.target.value })}>
        {weeks.map((w) => (
          <option key={w} value={String(w)}>
            {note(w) ? `Week ${w} · ${note(w)}` : `Week ${w}`}
          </option>
        ))}
        <option value="season">Season</option>
      </select>
    </label>
  ) : (
    <div role="group" aria-label="Week" className="rank-chips ledger-weeks">
      {weeks.map((w) => (
        <button key={w} type="button" className="rank-chip" aria-pressed={view === w} title={note(w) || undefined} onClick={() => set({ week: String(w) })}>
          W{w}
          {note(w) === "live" && (
            <>
              {" "}
              <span className="ledger-live">live</span>
            </>
          )}
        </button>
      ))}
      <button type="button" className="rank-chip" aria-pressed={view === "season"} onClick={() => set({ week: "season" })}>
        Season
      </button>
    </div>
  );

  const weekView = (week: number) => {
    const ices = ledger && finalized.has(week) ? ledger.ices.filter((i) => i.week === week && keep(i)).sort(rowOrder(ledger, now)) : null;
    const owed = ices?.filter((i) => i.status === "owed").length ?? 0;
    return (
      <>
        {ices && (
          <section aria-label="Who owes" className="xp-group who-owes">
            <h3 className="xp-group-title">
              Who owes · Week {week}
              <span className="ledger-count">
                {owed} owed · {ices.length - owed} paid
              </span>
            </h3>
            {ices.length ? owes(`Week ${week} ices`, ices) : <p>No ices match.</p>}
          </section>
        )}
        {recordSection(record(week))}
      </>
    );
  };

  const seasonView = () => {
    const groups = ledger ? owedGroups(ledger, now).map((g) => ({ ...g, ices: g.ices.filter(keep) })).filter((g) => g.ices.length) : [];
    const records = [...weeks].reverse().map(record).filter((r) => f.status === "all" || r.count > 0);
    const summary = ledger && summaryFor(ledger, tally.owed.map((t) => t.rosterId));
    return (
      <>
        {ledger && f.status !== "paid" && (
          <section aria-label="Still owed" className="xp-group who-owes">
            <h3 className="xp-group-title">Still owed</h3>
            {groups.length === 0 ? (
              <p>Nobody owes a chug. Suspicious.</p>
            ) : (
              groups.map((g) => {
                const title = g.deadline === "late" ? "Late" : g.deadline === null ? "No deadline yet" : dueLabel(g.deadline);
                return (
                  <div key={String(g.deadline)} className="owe-group" data-late={g.deadline === "late" || undefined}>
                    <h4 className="owe-group-title">{title}</h4>
                    {owes(title, g.ices)}
                  </div>
                );
              })
            )}
          </section>
        )}
        {records.map((r) => recordSection(r, true))}
        {summary && (
          <section aria-label="Season summary" className="xp-group ices-summary">
            <h3 className="xp-group-title">Season summary</h3>
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
          </section>
        )}
      </>
    );
  };

  return (
    <div className="ledger grid grid-cols-1 gap-3">
      <div className="ledger-bar">
        {picker}
        <div role="group" aria-label="Status" className="rank-chips">
          {STATUSES.map(({ value, label }) => (
            <button key={value} type="button" className="rank-chip" aria-pressed={f.status === value} onClick={() => set({ status: value })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {!ledger && (
        <p role="note" className="xp-note flex items-center gap-1">
          <WarningIcon className="shrink-0" />
          Ledger unavailable ({ledgerState.status === "error" && ledgerState.message}). Showing ices from Sleeper scores.
        </p>
      )}
      {view === "season" ? seasonView() : weekView(view)}
      {ledger && upload && createPortal(<UploadChug ices={ledger.ices} initialIceIds={upload} onClose={() => setUpload(null)} />, document.body)}
      {timing && <ChugTimeDialog ice={timing} label={iceLabel(timing, teamFor, data.players)} onClose={() => setTiming(null)} />}
      {playing &&
        createPortal(<ChugPlayer video={playing.video} label={playing.label} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </div>
  );
}

export const IcesWindow = ({ params }: { params?: WindowParams }) => <IceLedger params={params} />;
