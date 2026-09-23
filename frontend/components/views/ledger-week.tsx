"use client";

import type { ReactNode } from "react";

import { TeamName } from "@/components/xp/TeamName";
import type { LedgerIce } from "@/lib/api/ledger";
import { byRoster } from "@/lib/league/drill";
import type { Player, Team } from "@/lib/league/use-league";
import { DrillLink } from "./drill-link";
import { IceCause } from "./week-ices";

const paidOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

// Each original ice followed by its late ices. A late row whose parent is gone
// (voided after the late ice was paid) still counts, so it goes last.
function inLedgerOrder(ices: LedgerIce[]): LedgerIce[] {
  const late = ices.filter((i) => i.reason === "late").sort((a, b) => a.iceId.localeCompare(b.iceId));
  const originals = ices.filter((i) => i.reason !== "late").sort((a, b) => a.iceId.localeCompare(b.iceId));
  const placed = originals.flatMap((o) => [o, ...late.filter((l) => l.parentIceId === o.iceId)]);
  return [...placed, ...late.filter((l) => !placed.includes(l))];
}

interface LedgerRowProps {
  ice: LedgerIce;
  players: Record<string, Player>;
  action?: (ice: LedgerIce) => ReactNode;
}

function LedgerRow({ ice, players, action }: LedgerRowProps) {
  const done = ice.status === "completed";
  const late = ice.reason === "late";
  const status = !done ? "Owed" : ice.completedAt ? `Completed ${paidOn(ice.completedAt)}` : "Completed";
  return (
    <li className={`xp-player-row${done ? "" : " ice"}${late ? " pl-6" : ""}`}>
      <span className="xp-player-pos">{late ? "LATE" : (ice.slot ?? "TEAM")}</span>
      <span className="xp-player-name">
        {ice.reason === "late" ? `Late ice ${ice.iceId.split("#LATE")[1]}` : <IceCause ice={{ ...ice, reason: ice.reason }} players={players} />}
      </span>
      <span className="xp-watch-tag">{status}</span>
      {ice.points !== undefined && <span className="xp-player-pts">{ice.points.toFixed(2)}</span>}
      {action?.(ice)}
    </li>
  );
}

interface LedgerWeekProps {
  ices: LedgerIce[];
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
  action?: (ice: LedgerIce) => ReactNode;
}

export function LedgerWeek({ ices, players, teamFor, action }: LedgerWeekProps) {
  if (ices.length === 0) return <p>No ices this week.</p>;
  return (
    <div className="grid gap-3">
      {byRoster(ices).map(([rosterId, rows]) => {
        const owed = rows.filter((i) => i.status === "owed").length;
        return (
          <div key={rosterId}>
            <DrillLink to={{ kind: "team", rosterId }}>
              <TeamName name={teamFor(rosterId).name} iced={owed > 0} ices={owed} />
            </DrillLink>
            <ul aria-label={`${teamFor(rosterId).name} ices`} className="mt-1 bg-(--xp-cream)">
              {inLedgerOrder(rows).map((ice) => (
                <LedgerRow key={ice.iceId} ice={ice} players={players} action={action} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
