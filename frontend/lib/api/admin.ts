import type { WeekSettings } from "@/lib/ices/compute";
import type { LedgerIce } from "./ledger";
import { request } from "./users";

const post = <T>(path: string, body: object) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const addIce = (week: number, rosterId: number, note: string) =>
  post<LedgerIce>("/admin/ice-adjust", { action: "add", week, rosterId, note });

export const voidIce = (iceId: string, note: string) => post<LedgerIce>("/admin/ice-adjust", { action: "void", iceId, note });

/** `at` is an ISO time with offset, for backdating; the server defaults to now. */
export const setIceCompleted = (iceId: string, completed: boolean, at?: string) =>
  post<LedgerIce>("/admin/ice-complete", at ? { iceId, completed, at } : { iceId, completed });

export const setChugTime = (iceId: string, seconds: number) => post<LedgerIce>("/admin/chug-time", { iceId, seconds });

export const setWeekRules = (week: number, rules: Partial<WeekSettings>) =>
  post<unknown>("/admin/settings", { week, ...rules });

export const setToiletByes = (byes: [number, number]) => post<unknown>("/admin/settings", { toiletByes: byes });

export const finalizeWeek = (week: number, refinalize = false) =>
  post<unknown>("/admin/finalize", refinalize ? { week, refinalize } : { week });
