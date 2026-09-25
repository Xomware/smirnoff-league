"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";

import { ChugPlayer } from "@/components/videos/ChugPlayer";
import { DrillLink } from "@/components/views/drill-link";
import { OweRows } from "@/components/views/ledger-owes";
import type { Video } from "@/lib/api/videos";
import { timeLeft } from "@/lib/ices/chug-board";
import { etDay, etDeadline, nextDue } from "@/lib/ices/ledger-weeks";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useLeague } from "@/lib/league/use-league";
import { useVideos } from "@/lib/videos/use-videos";

import "@/components/windows/ledger.css";
import "./due-card.css";

const at = (deadline: number) => `${etDay(deadline)} · ${etDeadline(deadline).split(" ").slice(1).join(" ")}`;

// Everyone with an ice due at the next deadline, paid or not, under one countdown.
export function DueSunday() {
  const ledgerState = useLedger();
  const { data, teamFor } = useLeague();
  const { state: videos, onVideoError } = useVideos();
  const [playing, setPlaying] = useState<{ video: Video; label: string } | null>(null);
  const ledger = ledgerState.status === "ok" ? ledgerState.ledger : null;
  const now = useNow(ledger?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);

  if (ledgerState.status === "error") return <p role="alert">The ledger is unavailable ({ledgerState.message}).</p>;
  if (!ledger || !data) return <p role="status">Checking the ledger...</p>;

  const due = nextDue(ledger, now);
  const rows = (label: string, ices: typeof due.ices) => (
    <OweRows
      label={label}
      ledger={ledger}
      ices={ices}
      now={now}
      players={data.players}
      teamFor={teamFor}
      videos={videos.status === "ok" ? videos.videos : []}
      onPlay={(video, label) => setPlaying({ video, label })}
      plain
    />
  );

  return (
    <div className="due-card">
      {due.week === null ? (
        <p className="due-square">
          Everyone&apos;s square until next week.
          <span className="due-next">Next deadline {at(due.deadline)}</span>
        </p>
      ) : (
        <p className="due-clock">
          <span className="due-count">{timeLeft(due.deadline - now)}</span>
          <span className="due-next">
            until Week {due.week} ices are due, {at(due.deadline)}
          </span>
        </p>
      )}
      {due.late.length > 0 && (
        <div className="owe-group" data-late>
          <h3 className="owe-group-title">Late</h3>
          {rows("Late", due.late)}
        </div>
      )}
      {due.ices.length > 0 && (
        <div className="owe-group">
          <h3 className="owe-group-title">Due {etDay(due.deadline)}</h3>
          {rows(`Due Week ${due.week}`, due.ices)}
        </div>
      )}
      {playing &&
        createPortal(<ChugPlayer video={playing.video} label={playing.label} onError={onVideoError} onClose={() => setPlaying(null)} />, document.body)}
    </div>
  );
}

export function useDueLink() {
  const ledger = useLedger();
  const now = useNow([]);
  const week = ledger.status === "ok" ? nextDue(ledger.ledger, now).week : null;
  return week === null ? ({ kind: "ices" } as const) : ({ kind: "ices", filter: `week-${week}` } as const);
}

interface DueCardProps {
  className: string;
  titleClass: string;
  Heading?: "h2" | "h3";
}

// XP's Home window and the XP phone; Glacier wraps DueSunday in its own panel.
export function DueCard({ className, titleClass, Heading = "h3" }: DueCardProps) {
  const title = useId();
  const link = useDueLink();
  return (
    <section aria-labelledby={title} className={`due-section ${className}`}>
      <div className="due-head">
        <Heading id={title} className={titleClass}>
          Due Sunday
        </Heading>
        <DrillLink to={link}>
          See ledger
        </DrillLink>
      </div>
      <DueSunday />
    </section>
  );
}
