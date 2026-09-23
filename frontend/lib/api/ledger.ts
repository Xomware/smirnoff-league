import type { Ice } from "@/lib/ices/compute";
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
  videoId?: string;
  note?: string;
}

export interface LedgerWeek {
  week: number;
  finalizedAt: string | null;
  deadlineUtc: string | null;
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
}

export async function getLedger(): Promise<Ledger> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Ledger>("/ledger/get", { method: "GET" });
}
