"use client";

import { useState } from "react";

import { iceCauseText } from "@/components/videos/ice-label";
import { UploadChugButton } from "@/components/videos/UploadChug";
import { IceBadge } from "@/components/xp/IceBadge";
import { StarIcon } from "@/components/xp/icons";
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
  // The phone: three teams until asked for the rest, one line each.
  compact?: boolean;
}

const COMPACT_TEAMS = 3;

// Originals before their late rows, oldest week first.
const order = (a: LedgerIce, b: LedgerIce) =>
  a.week - b.week || Number(a.reason === "late") - Number(b.reason === "late") || a.iceId.localeCompare(b.iceId);

// Every team with an unpaid ice, most owed first, each ice with its own clock.
export function WhoOwes({ ledger, now, players, teamFor, myRosterId, onUpload, compact = false }: WhoOwesProps) {
  const [all, setAll] = useState(false);
  const owed = ledger.ices.filter((i) => i.status === "owed").sort(order);
  const teams = [...new Set(owed.map((i) => i.rosterId))]
    .map((rosterId) => ({ rosterId, ices: owed.filter((i) => i.rosterId === rosterId) }))
    .sort((a, b) => b.ices.length - a.ices.length || a.rosterId - b.rosterId);

  const due = (ice: LedgerIce) => {
    if (isLate(ledger, ice, now)) return { level: "late", text: "LATE" };
    const deadline = deadlineOf(ledger, ice.week);
    return deadline === null ? { level: "due", text: "Owed" } : { level: urgency(deadline, now), text: countdown(deadline, now, 0) };
  };

  if (teams.length === 0) return <p>Nobody owes a chug. Suspicious.</p>;
  const shown = all || !compact ? teams : teams.slice(0, COMPACT_TEAMS);
  return (
    <>
      <ul aria-label="Who owes now" className="grid grid-cols-1 gap-3">
        {shown.map(({ rosterId, ices }) => {
          const name = teamFor(rosterId).name;
          const mine = rosterId === myRosterId;
          // Two lines on a phone: the team with one status, then the count and
          // the oldest ice's clock, which is the closest to or furthest past due.
          if (compact) {
            const late = ices.some((i) => isLate(ledger, i, now));
            const clock = late ? "past the deadline" : due(ices[0]).text;
            return (
              <li key={rosterId} className="who-owes-line">
                <DrillLink to={{ kind: "team", rosterId }}>
                  <span className="xp-team">
                    <span className="xp-avatar ice" aria-hidden>
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="xp-team-name ice">{name}</span>
                    {mine && <StarIcon className="shrink-0" role="img" aria-hidden={false} aria-label="Your team" />}
                  </span>
                </DrillLink>
                <span className="trouble-tag" data-trouble={late ? "late" : "owe"}>
                  {late ? "Late" : "Owes"}
                </span>
                <span className="who-owes-meta">
                  x{ices.length} · {clock}
                </span>
                {mine && (
                  <UploadChugButton onClick={() => onUpload(ices.filter((i) => i.week === ices[0].week).map((i) => i.iceId))} />
                )}
              </li>
            );
          }
          const head = (
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
          );
          return (
            <li key={rosterId} className="ice-team">
              {head}
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
      {shown.length < teams.length && (
        <button type="button" className="xp-button ov-more" onClick={() => setAll(true)}>
          See all {teams.length}
        </button>
      )}
    </>
  );
}
