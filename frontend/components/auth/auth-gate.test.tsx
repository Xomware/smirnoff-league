// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

const nav = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import AuthCallbackPage from "@/app/auth/callback/page";
import { getMe } from "@/lib/api/users";
import { AuthGate } from "./auth-gate";

function signedIn() {
  vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: { idToken: { payload: { email: "member@example.com" } } },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>);
  vi.mocked(getMe).mockResolvedValue({
    sub: "u",
    email: "member@example.com",
    isAdmin: false,
    profile: { name: "Member", username: "member", rosterId: 1, createdAt: "", updatedAt: "" },
  });
}

function signedOut() {
  vi.mocked(getCurrentUser).mockRejectedValue(new Error("not signed in"));
  // The landing's league status fetches Sleeper; offline, it just hides.
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuthGate", () => {
  it("renders the landing on /standings when signed out", async () => {
    signedOut();
    nav.pathname = "/standings/";
    render(<AuthGate>standings content</AuthGate>);

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    expect(screen.getAllByRole("button", { name: /sign in with google/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("standings content")).toBeNull();
  });

  it("renders the children when signed in", async () => {
    signedIn();
    nav.pathname = "/standings/";
    render(<AuthGate>standings content</AuthGate>);

    expect(await screen.findByText("standings content")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
  });

  it("always renders the callback route, even signed out", async () => {
    signedOut();
    nav.pathname = "/auth/callback/";
    render(
      <AuthGate>
        <AuthCallbackPage />
      </AuthGate>,
    );

    expect(screen.getByRole("status").textContent).toMatch(/signing you in/i);
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
  });
});
