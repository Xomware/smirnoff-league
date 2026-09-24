import { fireEvent, render, screen, within } from "@testing-library/react";
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

const renderStats = () =>
  render(
    <AuthGate>
      <StatsView params={{}} />
    </AuthGate>,
  );

describe("Ice Stats, signed in", () => {
  it("opens on the Overview with W1/W2 ices by week", async () => {
    renderStats();

    const byWeek = await screen.findByRole("img", { name: /ices by week/i });
    expect(byWeek.getAttribute("aria-label")).toBe("Ices by week: W1 5, W2 3");
    expect(byWeek.querySelectorAll("rect.stats-bar")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("region", { name: /Heat Check/ }).textContent).toContain(
      "Team 13 is most likely to ice next, with 2 ices in the last 3 weeks.",
    );
  });

  it("charts the heat check: rank, team, a column per finished recent week, then the score", async () => {
    renderStats();
    const heat = await screen.findByRole("region", { name: /Heat Check/ });
    expect([...(heat.querySelector(".board-head")?.children ?? [])].map((c) => c.textContent)).toEqual(["RK", "Team", "LW", "2W", "Pts"]);
    const [first] = within(heat).getAllByRole("listitem");
    expect(first.className).toContain("board-row");
    expect(first.querySelector(".board-rank")?.textContent).toBe("1");
    expect(first.querySelector(".board-name")?.textContent).toBe("Team 13");
    expect([...first.querySelectorAll(":scope > .board-num")].map((n) => n.textContent)).toEqual([
      "2 last week",
      "0 2 weeks ago",
      "6 pts",
    ]);
    expect(first.querySelector(".board-sub")).toBeNull();
  });

  it("races the W1/W2 cumulative ices with the top 3 drawn in colour", async () => {
    renderStats();
    fireEvent.click(await screen.findByRole("tab", { name: "Race" }));

    const race = screen.getByRole("img", { name: /^Ice race/ });
    expect(race.getAttribute("aria-label")).toMatch(
      /^Ice race, cumulative ices by week\. Team 6: W1 2, W2 2; Team 12: W1 1, W2 2; Team 13: W1 0, W2 2; the other 11: Team 2 1, Team 8 1, /,
    );
    expect(race.querySelectorAll(".line-top")).toHaveLength(3);
    expect(race.querySelectorAll(".line-rest")).toHaveLength(11);
    expect(screen.getByRole("region", { name: "Ice Race" }).textContent).toContain(
      "Team 6, Team 12 and Team 13 are tied for the lead on 2 ices.",
    );
  });

  it("shows roster 2 left 37.8 on the bench in W1, the 23.7 TE included", async () => {
    renderStats();
    fireEvent.click(await screen.findByRole("tab", { name: "Lineups" }));

    const bench = screen.getByRole("region", { name: "Bench Points Left" });
    expect(within(bench).getByRole("img").getAttribute("aria-label")).toContain("Team 2 38.9 / 37.8");
    const r2 = within(bench)
      .getAllByRole("listitem")
      .find((li) => li.textContent?.startsWith("Team 2,"))!;
    expect(r2.textContent).toContain("W1: 37.8 left");
    expect(r2.textContent).toContain("Player 5022 (TE 23.7)");
  });

  it("keeps Avoidable Ices in the Hall of Shame tab, reached by keyboard", async () => {
    renderStats();
    const overview = await screen.findByRole("tab", { name: "Overview" });
    fireEvent.keyDown(overview, { key: "End" });

    const shame = screen.getByRole("tab", { name: "Hall of Shame" });
    expect(shame.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(shame);
    const first = within(screen.getByRole("region", { name: "Avoidable Ices" })).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Left 23.7 on the bench and chugged anyway");
    expect(first.textContent).toContain("Team 2");
  });
});
