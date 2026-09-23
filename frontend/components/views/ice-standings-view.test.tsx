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
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import { AuthGate } from "@/components/auth/auth-gate";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { DrillContext } from "./drill-link";
import { IceStandingsView } from "./ice-standings-view";

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
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  stubSleeper();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderView = () => {
  const drill = vi.fn();
  render(
    <AuthGate>
      <DrillContext.Provider value={drill}>
        <IceStandingsView />
      </DrillContext.Provider>
    </AuthGate>,
  );
  return drill;
};

const bodyRows = (table: HTMLElement) => within(table).getAllByRole("row").filter((r) => r.closest("tbody"));

describe("Ice Standings, signed in", () => {
  it("ranks 13, 12 and 6 at 2 ices and drills from roster 6's week 1 cell", async () => {
    const drill = renderView();

    const table = await screen.findByRole("table", { name: /ice standings/i });
    const top = bodyRows(table)
      .slice(0, 3)
      .map((r) => within(r).getAllByRole("cell").map((c) => c.textContent));
    expect(top.map((cells) => [cells[0], cells[1], cells[2]])).toEqual([
      ["1", expect.stringContaining("Team 13"), "2"],
      ["2", expect.stringContaining("Team 12"), "2"],
      ["3", expect.stringContaining("Team 6"), "2"],
    ]);
    expect(within(bodyRows(table)[2]).getByRole("img", { name: "Your team" })).toBeTruthy();

    const grid = screen.getByRole("table", { name: /season grid/i });
    expect(within(grid).getByRole("columnheader", { name: "Wk 3 (live)" })).toBeTruthy();
    const row6 = within(grid).getByRole("rowheader", { name: "Team 6" }).closest("tr")!;
    const week1 = within(row6).getAllByRole("cell")[0];
    expect(week1.textContent).toContain("2 ices");

    fireEvent.click(within(week1).getByRole("button"));
    expect(drill).toHaveBeenCalledWith({ kind: "week", week: 1 });
  });

  it("sorts on a header click and reports it with aria-sort", async () => {
    const drill = renderView();

    const table = await screen.findByRole("table", { name: /ice standings/i });
    const teamHeader = within(table).getByRole("columnheader", { name: /team/i });
    expect(teamHeader.getAttribute("aria-sort")).toBeNull();

    fireEvent.click(within(teamHeader).getByRole("button"));
    expect(teamHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(bodyRows(table)[0].textContent).toContain("Team 1");

    fireEvent.click(within(bodyRows(table)[0]).getByRole("button"));
    expect(drill).toHaveBeenCalledWith({ kind: "team", rosterId: 1 });
  });

  it("adds Completed and Late columns from the ledger summary, sortable like the rest", async () => {
    renderView();

    const table = await screen.findByRole("table", { name: /ice standings/i });
    const headers = within(table).getAllByRole("columnheader").map((c) => c.textContent);
    expect(headers.slice(0, 5)).toEqual(["#", "Team", "Ices", "Completed", "Late"]);
    const row6 = within(table).getByText("Team 6").closest("tr")!;
    expect(within(row6).getAllByRole("cell").map((c) => c.textContent).slice(3, 5)).toEqual(["2", "0"]);

    const late = within(table).getByRole("columnheader", { name: /late/i });
    fireEvent.click(within(late).getByRole("button"));
    expect(late.getAttribute("aria-sort")).toBe("descending");
    expect(bodyRows(table).map((r) => within(r).getAllByRole("cell")[4].textContent).slice(0, 3)).toEqual(["2", "1", "0"]);
    expect(bodyRows(table)[0].textContent).toContain("Team 13");
  });

  it("shows a dash in the ledger columns when the ledger is unavailable", async () => {
    vi.mocked(getLedger).mockRejectedValue(new Error("API not configured"));
    renderView();

    const table = await screen.findByRole("table", { name: /ice standings/i });
    const row13 = within(table).getByText("Team 13").closest("tr")!;
    expect(within(row13).getAllByRole("cell").map((c) => c.textContent).slice(3, 5)).toEqual(["—", "—"]);
  });
});
