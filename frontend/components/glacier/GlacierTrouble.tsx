"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";

import { UploadChug } from "@/components/videos/UploadChug";
import { type MyDue, myDue } from "@/lib/ices/chug-board";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useTrouble } from "@/lib/ices/use-trouble";
import { useLeague } from "@/lib/league/use-league";
import { type Notification, sentence } from "@/lib/notifications/derive";
import { useNotifications } from "@/lib/notifications/use-notifications";
import { useProfile } from "@/lib/profile/use-profile";

import "./glacier-trouble.css";

const ZEROS_KEY = "smirnoff:glacier-zeros-dismissed";
// A comment on your chug is not trouble, but it is news you would want surfaced the same way.
const WARN = new Set<Notification["kind"]>(["due", "late", "iced", "comment"]);

interface Warning {
  id: string;
  title: string;
  body: string;
  comment?: boolean;
}

function readZeros(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(ZEROS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function WarningToasts() {
  const { items, seenAt } = useNotifications();
  const { markNotificationsSeen } = useProfile();
  const { myZeros } = useTrouble();
  const { data } = useLeague();
  const [gone, setGone] = useState(readZeros);
  const titleId = useId();

  const seen = seenAt ? Date.parse(seenAt) : -Infinity;
  const owed = items.filter((n) => WARN.has(n.kind) && n.at > seen).reverse();
  const zeros = myZeros
    .filter((s) => !gone.includes(`${s.id}:${s.state}`))
    .map((s): Warning => {
      const name = data?.players[s.playerId ?? ""]?.name ?? s.playerId;
      const pts = s.points.toFixed(1);
      const id = `${s.id}:${s.state}`;
      if (s.state === "OPEN") return { id, title: "FIX YOUR LINEUP", body: s.playerId ? `${name} won't play in your ${s.slot} slot.` : `${s.slot} is empty.` };
      return s.state === "WATCH"
        ? { id, title: "ICE WATCH", body: `${name} has ${pts} pts after halftime.` }
        : { id, title: "ICED", body: `${name} finished with ${pts} pts. That's an ice.` };
    });
  const warnings = [...zeros, ...owed.map((n): Warning => ({ id: n.id, title: n.title, body: sentence(n.body), comment: n.kind === "comment" }))];
  const [first] = warnings;
  if (!first) return null;

  // The same seen mark as opening the notifications list, taken only up to this
  // item, so the 48h and 6h reminders still come after a Friday dismissal.
  const dismiss = () => {
    const item = owed.find((n) => n.id === first.id);
    if (item) {
      // On failure the profile rolls the mark back, and the warning shows again.
      markNotificationsSeen(new Date(item.at).toISOString()).catch(() => {});
      return;
    }
    const next = [...gone, first.id];
    setGone(next);
    try {
      window.sessionStorage.setItem(ZEROS_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: state still holds it until the page reloads.
    }
  };

  return createPortal(
    <section key={first.id} role="alert" aria-labelledby={titleId} className="gt-toast">
      <svg className="gt-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={first.comment ? "M3 4h18v12h-9l-5 4v-4H3zM7 8.5h10M7 12h6" : "M12 3L2 20h20zM12 10v4M12 17v.5"} />
      </svg>
      <div className="gt-copy">
        <strong id={titleId}>{first.title}</strong>
        <p>{first.body}</p>
        {warnings.length > 1 && <p className="gt-more">{warnings.length - 1} more after this</p>}
      </div>
      <button type="button" className="gt-dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </section>,
    document.body,
  );
}

const etDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });

const dueWhen = (due: MyDue) =>
  due.level === "late" ? "LATE" : due.deadline === null ? null : `due ${etDay.format(due.deadline).replace(":00", "")}`;

// XP's tray DueWarning, as a header pill: the deadline by day, not a countdown.
function DuePill() {
  const ledger = useLedger();
  const { myRosterId } = useProfile();
  const [upload, setUpload] = useState(false);
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const now = useNow(ok?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);
  const due = ok && myDue(ok, myRosterId, now);
  if (!ok || !due) return null;
  const when = dueWhen(due);
  const ices = `${due.count} ${due.count === 1 ? "ice" : "ices"}`;

  return (
    <>
      <button
        type="button"
        className="gt-due"
        data-level={due.level}
        aria-label={`You owe ${ices}${when ? `, ${when}` : ""}. Upload your chug.`}
        onClick={() => setUpload(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3L2 20h20zM12 10v4M12 17v.5" />
        </svg>
        <span className="gt-due-full" aria-hidden="true">
          You owe {due.count}
          {when && ` · ${when}`}
        </span>
        <span className="gt-due-short" aria-hidden="true">
          {due.count} owed{due.level === "late" && " · LATE"}
        </span>
      </button>
      {upload && createPortal(<UploadChug ices={ok.ices} initialIceIds={due.iceIds.slice(0, 1)} onClose={() => setUpload(false)} />, document.body)}
    </>
  );
}

/** Your own trouble: the owed pill that opens the upload, and the warning toasts. */
export function GlacierTrouble() {
  return (
    <>
      <DuePill />
      <WarningToasts />
    </>
  );
}
