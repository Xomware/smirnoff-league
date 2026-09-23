import type { LedgerIce } from "@/lib/api/ledger";
import { SLOTS } from "@/lib/ices/compute";
import type { Player, Team } from "@/lib/league/use-league";

// A team can owe several late ices numbered 1, so name the ice each came from.
// Parent ids end in #S{slot}, #LOWEST or #ADMIN{n}.
function parentCause(parentIceId = ""): string {
  const tail = parentIceId.split("#").pop() ?? "";
  if (tail === "LOWEST") return "lowest score";
  if (tail.startsWith("ADMIN")) return "admin ice";
  const slot = SLOTS[Number(tail.slice(1))];
  return slot ? `${slot} slot` : "ice";
}

// Plain text for <option>s, which can't hold IceCause's drill links.
export function iceCauseText(ice: LedgerIce, players: Record<string, Player>): string {
  if (ice.reason === "late") return `Late ice ${ice.iceId.split("#LATE")[1] ?? ""} · ${parentCause(ice.parentIceId)}`;
  if (ice.reason === "lowest") return "Lowest score";
  if (ice.reason === "empty") return "Empty slot";
  if (ice.reason === "admin") return "Admin ice";
  return players[ice.playerId ?? ""]?.name ?? ice.playerId ?? "Zero";
}

export const iceLabel = (ice: LedgerIce, teamFor: (rosterId: number) => Team, players: Record<string, Player>) =>
  `Week ${ice.week} · ${teamFor(ice.rosterId).name} · ${iceCauseText(ice, players)}`;
