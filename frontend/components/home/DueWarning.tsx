"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { UploadChug } from "@/components/videos/UploadChug";
import { WarningIcon } from "@/components/xp/icons";
import { myDue } from "@/lib/ices/chug-board";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useProfile } from "@/lib/profile/use-profile";

import "./chugs.css";

// The signed-in manager's own debt, in the taskbar tray.
export function DueWarning() {
  const ledger = useLedger();
  const { myRosterId } = useProfile();
  const [upload, setUpload] = useState(false);
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const now = useNow(ok?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);
  const due = ok && myDue(ok, myRosterId, now);
  if (!ok || !due) return null;

  return (
    <>
      <button type="button" className={`due-warning due-${due.level}`} aria-label={due.text} title={due.text} onClick={() => setUpload(true)}>
        <WarningIcon width={16} height={16} className="shrink-0" />
        <span className="due-long" aria-hidden>{due.text}</span>
        <span className="due-short" aria-hidden>
          Owe {due.count}
          {due.when && <> &middot; {due.when}</>}
        </span>
      </button>
      {upload && createPortal(<UploadChug ices={ok.ices} initialIceIds={due.iceIds.slice(0, 1)} onClose={() => setUpload(false)} />, document.body)}
    </>
  );
}
