import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface Profile {
  name: string;
  username: string;
  rosterId: number;
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

export const updateMe = (input: ProfileInput) =>
  request<Profile>("/users/update", { method: "POST", body: JSON.stringify(input) });
