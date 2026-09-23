import type { Ice, WeekSettings } from "@/lib/ices/compute";
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
  /** Who chugged it; untimed or unnamed ices have none. */
  chugger?: { name: string };
  timedAt?: string;
  videoId?: string;
  note?: string;
}

export interface LedgerWeek {
  week: number;
  finalizedAt: string | null;
  deadlineUtc: string | null;
  // Optional until the backend that sends them is deployed.
  iceRulesActive?: boolean;
  lowestScope?: WeekSettings["lowestScope"];
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

/** A league user by sub, or free text for someone without an account. Only admins may name one. */
export type ChuggerPick = { sub: string } | { name: string };

// The server rounds to a tenth. Players time their own roster's ices; admins time any.
export const logChugTime = (iceId: string, seconds: number, chugger?: ChuggerPick) =>
  request<LedgerIce>("/ices/chug-time", { method: "POST", body: JSON.stringify(chugger ? { iceId, seconds, chugger } : { iceId, seconds }) });

export async function getLedger(): Promise<Ledger> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Ledger>("/ledger/get", { method: "GET" });
}
