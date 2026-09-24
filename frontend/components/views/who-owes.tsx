"use client";

import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChugButton } from "@/components/videos/UploadChug";
import { IceBadge } from "@/components/xp/IceBadge";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import { countdown, urgency } from "@/lib/ices/chug-board";
import { deadlineOf, isLate } from "@/lib/ices/ledger-stats";
import type { Player, Team } from "@/lib/league/use-league";
import { DrillLink } from "./drill-link";

interface WhoOwesProps {
  ledger: Ledger;
  now: number;
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
  myRosterId: number | null;
  onUpload: (iceIds: string[]) => void;
}

// Originals before their late rows, oldest week first.
const order = (a: LedgerIce, b: LedgerIce) =>
  a.week - b.week || Number(a.reason === "late") - Number(b.reason === "late") || a.iceId.localeCompare(b.iceId);

// Every team with an unpaid ice, most owed first, each ice with its own clock.
export function WhoOwes({ ledger, now, players, teamFor, myRosterId, onUpload }: WhoOwesProps) {
  const owed = ledger.ices.filter((i) => i.status === "owed").sort(order);
  const teams = [...new Set(owed.map((i) => i.rosterId))]
    .map((rosterId) => ({ rosterId, ices: owed.filter((i) => i.rosterId === rosterId) }))
    .sort((a, b) => b.ices.length - a.ices.length || a.rosterId - b.rosterId);

  const due = (ice: LedgerIce) => {
    if (isLate(ledger, ice, now)) return { level: "late", text: "LATE" };
    const deadline = deadlineOf(ledger, ice.week);
    return deadline === null ? { level: "due", text: "Owed" } : { level: urgency(deadline, now), text: countdown(deadline, now, 0) };
  };

  return (
    <section className="xp-group who-owes">
      <h3 className="xp-group-title">Who owes now</h3>
      {teams.length === 0 ? (
        <p>Nobody owes a chug. Suspicious.</p>
      ) : (
        <ul aria-label="Who owes now" className="grid grid-cols-1 gap-3">
          {teams.map(({ rosterId, ices }) => {
            const name = teamFor(rosterId).name;
            const mine = rosterId === myRosterId;
            return (
              <li key={rosterId} className="ice-team">
                <div className="who-owes-head">
                  <DrillLink to={{ kind: "team", rosterId }}>
                    <TeamName name={name} iced ices={0} isMine={mine} />
                  </DrillLink>
                  {/* One video covers one week, so the oldest week's ices come ticked. */}
                  {mine ? (
                    <UploadChugButton onClick={() => onUpload(ices.filter((i) => i.week === ices[0].week).map((i) => i.iceId))} />
                  ) : (
                    <IceBadge count={ices.length} />
                  )}
                </div>
                <ul aria-label={`${name} owed ices`} className="mt-1 bg-(--xp-cream)">
                  {ices.map((ice) => {
                    const { level, text } = due(ice);
                    return (
                      <li key={ice.iceId} className="xp-player-row ice">
                        <span className="xp-player-pos">W{ice.week}</span>
                        <span className="xp-player-name">{iceCauseText(ice, players)}</span>
                        <span className="xp-watch-tag who-owes-due" data-level={level}>
                          {text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
