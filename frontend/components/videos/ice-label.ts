import type { LedgerIce } from "@/lib/api/ledger";
import type { Player, Team } from "@/lib/league/use-league";

// Plain text for <option>s, which can't hold IceCause's drill links.
export function iceCauseText(ice: LedgerIce, players: Record<string, Player>): string {
  if (ice.reason === "late") return `Late ice ${ice.iceId.split("#LATE")[1] ?? ""}`.trim();
  if (ice.reason === "lowest") return "Lowest score";
  if (ice.reason === "empty") return "Empty slot";
  if (ice.reason === "admin") return "Admin ice";
  return players[ice.playerId ?? ""]?.name ?? ice.playerId ?? "Zero";
}

export const iceLabel = (ice: LedgerIce, teamFor: (rosterId: number) => Team, players: Record<string, Player>) =>
  `Week ${ice.week} · ${teamFor(ice.rosterId).name} · ${iceCauseText(ice, players)}`;
