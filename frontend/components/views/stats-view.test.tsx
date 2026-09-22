import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/stats/" }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import { AuthGate } from "@/components/auth/auth-gate";
import { getMe } from "@/lib/api/users";
import { stubSleeper } from "@/lib/test/league-mock";
import { StatsView } from "./stats-view";

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: { idToken: { payload: { email: "player@example.com" } } },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>);
  vi.mocked(getMe).mockResolvedValue({
    sub: "abc",
    email: "player@example.com",
    isAdmin: false,
    profile: {
      name: "Player One",
      username: "player.one",
      rosterId: 6,
      createdAt: "2026-09-22T12:00:00+00:00",
      updatedAt: "2026-09-22T12:00:00+00:00",
    },
  });
  stubSleeper();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ice Stats, signed in", () => {
  it("charts W1/W2 ices by week and leads Avoidable Ices with the 23.7 left on the bench", async () => {
    render(
      <AuthGate>
        <StatsView />
      </AuthGate>,
    );

    const byWeek = await screen.findByRole("img", { name: /ices by week/i });
    expect(byWeek.getAttribute("aria-label")).toBe("Ices by week: W1 5, W2 3");
    expect(byWeek.querySelectorAll("rect.stats-bar")).toHaveLength(2);

    const avoidable = screen.getByRole("region", { name: "Avoidable Ices" });
    const first = within(avoidable).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Left 23.7 on the bench and chugged anyway");
    expect(first.textContent).toContain("Team 2");
  });
});
