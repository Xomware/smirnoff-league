import type { Ice } from "@/lib/ices/compute";
import type { LowestScope } from "./admin";
import { ApiError, request } from "./users";

export interface LedgerIce {
  iceId: string;
  week: number;
  rosterId: number;
  reason: Ice["reason"] | "late" | "admin";
  /** Voided rows never reach the client. */
  status: "owed" | "completed";
  slotIndex?: number | null;
  slot?: string | null;
  playerId?: string | null;
  points?: number;
  completedAt?: string | null;
  parentIceId?: string;
  chugSeconds?: number;
  note?: string;
}

export interface LedgerWeek {
  week: number;
  finalizedAt: string | null;
  deadlineUtc: string | null;
  // Optional until the backend that sends them is deployed.
  iceRulesActive?: boolean;
  lowestScope?: LowestScope;
}

/** owed, completed and overdue count original ices; late and lateOwed count late ices. */
export interface LedgerSummary {
  rosterId: number;
  owed: number;
  completed: number;
  late: number;
  lateOwed: number;
  overdue: number;
}

export interface Ledger {
  ices: LedgerIce[];
  weeks: LedgerWeek[];
  summary: LedgerSummary[];
  toiletByes?: number[];
}

export async function getLedger(): Promise<Ledger> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Ledger>("/ledger/get", { method: "GET" });
}
