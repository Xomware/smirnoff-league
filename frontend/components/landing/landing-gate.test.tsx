import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { stubSleeper } from "@/lib/test/league-mock";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("signed-out visitor during week 3", () => {
  it("sees week 3, the ice leader and the sign-in button", async () => {
    stubSleeper();
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).includes("espn.com")
        ? jsonResponse({ events: [espnEvent({ home: "GB", away: "CHI", date: "2026-09-25T00:15Z" })] })
        : sleeper(input, init),
    );

    render(<AuthGate>scores content</AuthGate>);

    // Rosters 6, 12 and 13 each owe 2 after weeks 1-2; 13 has the fewest points-for.
    expect((await screen.findByTestId("ice-leader")).textContent).toContain("Team 13");
    const status = screen.getByRole("region", { name: /league status/i });
    expect(within(status).getByText("Week 3 kicks off Thu 8:15 PM ET")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /sign in with google/i }).length).toBeGreaterThan(0);
  });
});
