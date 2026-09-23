import { fetchAuthSession } from "aws-amplify/auth";

import type { Theme } from "@/lib/theme/theme";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const EMAIL_TYPES = {
  iced: "When I get iced",
  due48h: "48 hours before an ice is due",
  due6h: "6 hours before",
  lateAdded: "When a late ice is added",
  edition: "When the commish posts a new edition",
  videoOfMine: "When someone posts a video of my chug",
} as const;

export type EmailType = keyof typeof EMAIL_TYPES;

export interface EmailPrefs {
  optIn: boolean;
  types: Record<EmailType, boolean>;
}

export interface Profile {
  name: string;
  username: string;
  rosterId: number;
  // Optional until the backend that sends it is deployed.
  email?: EmailPrefs;
  // Optional until the backend that sends it is deployed.
  notificationsSeenAt?: string | null;
  // Optional until the backend that sends it is deployed.
  theme?: Theme | null;
  createdAt: string;
  updatedAt: string;
}

export type ProfileInput = Pick<Profile, "name" | "username" | "rosterId">;

export interface Me {
  sub: string;
  email: string;
  /** Null until the user has onboarded. */
  profile: Profile | null;
  isAdmin: boolean;
}

interface Envelope<T> {
  data: T | null;
  error: { handler: string; message: string; detail?: Record<string, unknown> } | null;
  meta: Record<string, unknown> | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init: RequestInit): Promise<T> {
  // The ID token, not the access token: only the ID token carries `email`,
  // which the backend needs for the admin check. Fetched per call because
  // Amplify caches and refreshes it already.
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new ApiError(401, "Not signed in");

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: token },
  });
  // A rejection from the authorizer itself is { message }, not our envelope.
  const body = (await res.json()) as Partial<Envelope<T>>;
  if (!res.ok || body.error) {
    throw new ApiError(
      res.status,
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.detail,
    );
  }
  return body.data as T;
}

export const getMe = () => request<Me>("/users/me", { method: "GET" });

/** The profile fields, `notificationsSeenAt` alone to mark notifications read, or `email` or `theme` alone. */
export const updateMe = (
  input: ProfileInput | { notificationsSeenAt: string } | { email: EmailPrefs } | { theme: Theme },
) =>
  request<Profile>("/users/update", { method: "POST", body: JSON.stringify(input) });
