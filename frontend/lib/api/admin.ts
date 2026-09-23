import type { ActivityKind } from "@/lib/activity/tracker";
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

export interface AdminUser {
  sub: string;
  name: string;
  username: string;
  emailAddress: string | null;
  rosterId: number;
  createdAt: string;
  lastSeenAt: string | null;
  signInCount: number;
  /** "<device> <browser>", e.g. "iPhone Safari". */
  lastUa: string | null;
  emailOptIn: boolean;
}

export interface ActivityRow {
  at: string;
  kind: ActivityKind;
  target: string;
  ua: string;
}

export const listUsers = () => request<AdminUser[]>("/admin/users", { method: "GET" });

/** Newest first; the server caps `limit` at 200. */
export const listActivity = (sub: string, limit = 100) =>
  request<ActivityRow[]>(`/admin/activity?${new URLSearchParams({ sub, limit: String(limit) })}`, { method: "GET" });
