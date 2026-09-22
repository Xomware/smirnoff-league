import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not signed in")),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/scores/",
  useRouter: () => ({ replace: vi.fn() }),
}));

import { getCurrentUser, signInWithRedirect } from "aws-amplify/auth";

import { AuthGate } from "@/components/auth/auth-gate";

describe("signed-out visitor opening a shared link", () => {
  it("sees the landing with all four rules, and sign-in starts Google", async () => {
    render(<AuthGate>scores content</AuthGate>);
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());

    expect(screen.queryByText("scores content")).toBeNull();
    for (const name of [/zero means ice/i, /lowest score/i, /deadline/i, /toilet bowl/i]) {
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }

    fireEvent.click(screen.getAllByRole("button", { name: /sign in with google/i })[0]);
    await waitFor(() => expect(signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" }));
  });
});
