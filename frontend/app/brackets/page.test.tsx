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
  getCurrentUser: vi.fn(async () => ({ username: "u", userId: "u" })),
  fetchAuthSession: vi.fn(async () => ({
    tokens: { idToken: { payload: { email: "member@example.com" } } },
  })),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/brackets/",
  useRouter: () => ({ replace: vi.fn() }),
}));

import { AuthGate } from "@/components/auth/auth-gate";
import BracketsPage from "./page";

// Two weeks played: records spread 2-0 / 1-1 / 0-2, points-for breaks the ties.
// Roster ids are shuffled against standings so seeds cannot come from id order.
const records: [id: number, wins: number, fpts: number][] = [
  [7, 2, 281], [3, 2, 266], [12, 2, 259], [1, 2, 240],
  [9, 1, 262], [14, 1, 255], [5, 1, 248], [2, 1, 239], [11, 1, 233], [6, 1, 221],
  [13, 0, 247], [4, 0, 230], [10, 0, 214], [8, 0, 198],
];

const rosters = records.map(([id, wins, fpts]) => ({
  roster_id: id,
  owner_id: `u${id}`,
  co_owners: null,
  starters: [],
  players: [],
  settings: { wins, losses: 2 - wins, ties: 0, fpts, fpts_decimal: 50 },
}));

const users = records.map(([id]) => ({
  user_id: `u${id}`,
  display_name: `user${id}`,
  avatar: null,
  metadata: { team_name: `Team ${id}` },
}));

const league = "/league/1394061072742227968";
const responses: Record<string, unknown> = {
  [league]: {
    league_id: "1394061072742227968",
    name: "Smirnoff League",
    season: "2026",
    status: "in_season",
    total_rosters: 14,
    roster_positions: [],
    settings: { playoff_week_start: 15, playoff_teams: 8 },
  },
  [`${league}/users`]: users,
  [`${league}/rosters`]: rosters,
  [`${league}/winners_bracket`]: [],
  [`${league}/losers_bracket`]: null,
  "/state/nfl": { week: 3, display_week: 3, season: "2026", season_type: "regular", leg: 3 },
  "/data/players.json": {},
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace("https://api.sleeper.app/v1", "");
      if (!(path in responses)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(responses[path]), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Seeds 9-14 in standings order.
const bottomSix = ["Team 11", "Team 6", "Team 13", "Team 4", "Team 10", "Team 8"];

const teams = (el: HTMLElement) => within(el).queryAllByText(/^Team \d+$/).map((n) => n.textContent);

describe("Brackets page", () => {
  it("shows projected seeds and the closet watch list in week 3", async () => {
    render(
      <AuthGate>
        <BracketsPage />
      </AuthGate>,
    );

    const playoffs = await screen.findByRole("region", { name: "Playoffs" });
    expect(await within(playoffs).findByText("Projected")).toBeTruthy();
    expect(teams(playoffs)).toEqual([
      "Team 7", "Team 2", "Team 1", "Team 9", "Team 12", "Team 14", "Team 3", "Team 5",
    ]);

    const toilet = screen.getByRole("region", { name: "Toilet Bowl" });
    // Bye teams show again in round 2, so compare the distinct set.
    expect(new Set(teams(toilet))).toEqual(new Set(bottomSix));
    const byes = within(toilet).getByRole("list", { name: "Round 1 byes" });
    expect(teams(byes)).toEqual(["Team 10", "Team 8"]);

    const watch = screen.getByRole("list", { name: "At risk of the closet" });
    expect(teams(watch)).toEqual(bottomSix);
  });
});
