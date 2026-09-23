"use client";

import type { LedgerIce } from "@/lib/api/ledger";
import type { LedgerState } from "@/lib/ices/use-ledger";
import type { ResultRow } from "@/lib/league/profile";
import type { Player } from "@/lib/league/use-league";
import { DrillLink } from "./drill-link";
import { inLedgerOrder, paidOn } from "./ledger-week";

const REASONS: Record<LedgerIce["reason"], string> = {
  zero: "Zero points",
  empty: "Empty slot",
  lowest: "Lowest score",
  admin: "Admin ice",
  late: "Late ice",
};

interface TeamIcesProps {
  rosterId: number;
  ledger: LedgerState;
  results: ResultRow[];
  players: Record<string, Player>;
}

export function TeamIces({ rosterId, ledger, results, players }: TeamIcesProps) {
  if (ledger.status === "loading") return <p role="status">Loading the ledger...</p>;

  const provisional = ledger.status === "error";
  const ices: LedgerIce[] = provisional
    ? results.flatMap((r) => r.ices.map(({ id, ...ice }): LedgerIce => ({ ...ice, iceId: id, status: "owed" })))
    : ledger.ledger.ices.filter((i) => i.rosterId === rosterId);
  const weeks = [...new Set(ices.map((i) => i.week))].sort((a, b) => a - b);
  const rows = weeks.flatMap((w) => inLedgerOrder(ices.filter((i) => i.week === w)));

  return (
    <div className="grid gap-2">
      {provisional && (
        <p role="note" className="xp-note">
          Ledger unavailable ({ledger.message}). These are Sleeper&apos;s ices, not yet confirmed.
        </p>
      )}
      <div className="xp-table-scroll">
        <table className="xp-table">
          <caption className="sr-only">Season ices</caption>
          <thead>
            <tr>
              <th scope="col" className="w-18">Week</th>
              <th scope="col">Reason</th>
              <th scope="col">Player</th>
              <th scope="col" className="w-24">Status</th>
              <th scope="col" className="w-20">Paid</th>
              <th scope="col" className="w-20">Video</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>No ices this season. Stay thirsty.</td>
              </tr>
            )}
            {rows.map((ice) => {
              const late = ice.reason === "late";
              return (
                <tr key={ice.iceId} className={ice.status === "owed" && !provisional ? "profile-owed" : undefined}>
                  <td>{late ? "" : <DrillLink to={{ kind: "week", week: ice.week }}>Week {ice.week}</DrillLink>}</td>
                  <td className={late ? "pl-6" : undefined}>
                    {late ? `Late ice ${ice.iceId.split("#LATE")[1]}` : REASONS[ice.reason]}
                  </td>
                  <td>
                    {ice.playerId ? (
                      <DrillLink to={{ kind: "player", playerId: ice.playerId }}>{players[ice.playerId]?.name ?? ice.playerId}</DrillLink>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="font-bold">{provisional ? "Provisional" : ice.status === "owed" ? "Owed" : "Completed"}</td>
                  <td className="tabular-nums">{ice.completedAt ? paidOn(ice.completedAt) : "-"}</td>
                  {/* The video gallery (#73) will play these; until it lands a row can only say one exists. */}
                  <td>{ice.videoId ? "Uploaded" : "None"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
