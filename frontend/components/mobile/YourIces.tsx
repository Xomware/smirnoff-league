"use client";

import { useContext, useState } from "react";
import { createPortal } from "react-dom";

import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChug } from "@/components/videos/UploadChug";
import { DrillContext } from "@/components/views/drill-link";
import { IceBottleIcon } from "@/components/xp/icons";
import { myDue } from "@/lib/ices/chug-board";
import { useLedger } from "@/lib/ices/use-ledger";
import { useNow } from "@/lib/ices/use-now";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

// The signed-in manager's own debt, with the one button that pays it.
export function YourIces() {
  const ledger = useLedger();
  const { data } = useLeague();
  const { myRosterId, setEditing } = useProfile();
  const open = useContext(DrillContext);
  const [upload, setUpload] = useState(false);
  const ok = ledger.status === "ok" ? ledger.ledger : null;
  const now = useNow(ok?.weeks.flatMap((w) => (w.deadlineUtc ? [Date.parse(w.deadlineUtc)] : [])) ?? []);

  const body = () => {
    if (ledger.status === "loading") return <p role="status">Checking the ledger...</p>;
    if (ledger.status === "error") return <p role="alert">The ledger is unavailable ({ledger.message}).</p>;
    if (myRosterId === null) {
      return (
        <>
          <p>Claim your team to see what you owe.</p>
          <button type="button" className="m-button" onClick={() => setEditing(true)}>
            Pick your team
          </button>
        </>
      );
    }
    const due = myDue(ledger.ledger, myRosterId, now);
    if (!due) return <p className="m-square">You&apos;re square. Nothing owed.</p>;
    const owed = ledger.ledger.ices.filter((i) => due.iceIds.includes(i.iceId)).sort((a, b) => a.week - b.week);
    return (
      <>
        <button type="button" className="m-owe m-owe-open" aria-label={`${due.count} owed, open Ice Ledger`} onClick={() => open({ kind: "ices" })}>
          <span className="m-owe-count">{due.count}</span>
          <span>
            {due.count === 1 ? "ice" : "ices"} owed
            {due.when && (
              <span className="m-due" data-level={due.level}>
                {due.when}
              </span>
            )}
          </span>
        </button>
        <ul aria-label="Your owed ices" className="m-owed-list">
          {owed.map((ice) => (
            <li key={ice.iceId}>
              <span className="m-slot">W{ice.week}</span>
              {iceCauseText(ice, data?.players ?? {})}
            </li>
          ))}
        </ul>
        <button type="button" className="m-button m-button-go" onClick={() => setUpload(true)}>
          <IceBottleIcon height={28} />
          Upload your chug
        </button>
        {upload &&
          createPortal(
            // One video covers one week, so the oldest week's ices come ticked.
            <UploadChug
              ices={ledger.ledger.ices}
              initialIceIds={owed.filter((i) => i.week === owed[0].week).map((i) => i.iceId)}
              onClose={() => setUpload(false)}
            />,
            document.body,
          )}
      </>
    );
  };

  return (
    <section aria-labelledby="m-your-ices" className="m-card m-your-ices">
      <h2 id="m-your-ices" className="m-section-title">
        Your ices
      </h2>
      {body()}
    </section>
  );
}
