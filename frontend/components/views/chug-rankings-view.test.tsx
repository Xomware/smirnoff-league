import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { getLedger, type Ledger, type LedgerIce } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { refreshLedger } from "@/lib/ices/use-ledger";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { stubSleeper } from "@/lib/test/league-mock";
import { ChugRankingsView } from "./chug-rankings-view";
import { DrillContext } from "./drill-link";

const timed = (iceId: string, week: number, rosterId: number, chugSeconds: number, name: string): LedgerIce => ({
  iceId,
  week,
  rosterId,
  reason: "zero",
  status: "completed",
  chugSeconds,
  chugger: { name },
});

const LEDGER: Ledger = {
  ices: [
    timed("W01#R03#S1", 1, 3, 8, "Chugger A"),
    timed("W01#R05#S1", 1, 5, 8, "Chugger B"),
    timed("W01#R07#S1", 1, 7, 10, "Chugger C"),
    timed("W01#R07#S2", 1, 7, 10, "Chugger C"),
    timed("W01#R09#S1", 1, 9, 13, "Chugger D"),
    timed("W02#R09#S1", 2, 9, 9.5, "Chugger D"),
    { iceId: "W02#R04#S1", week: 2, rosterId: 4, reason: "zero", status: "owed" },
  ],
  weeks: [],
  summary: [],
};

const texts = (rows: HTMLElement[]) => rows.map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent));

beforeEach(() => {
  stubSleeper();
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Chugger C", username: "c", rosterId: 7, createdAt: "", updatedAt: "" },
  });
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
  refreshLedger();
});
afterEach(() => vi.clearAllMocks());

const renderView = (open = vi.fn()) =>
  render(
    <ProfileProvider>
      <DrillContext.Provider value={open}>
        <ChugRankingsView />
      </DrillContext.Provider>
    </ProfileProvider>,
  );

describe("Ice Rankings", () => {
  it("ranks chuggers by PR with shared ranks, and marks my row", async () => {
    renderView();
    expect(await screen.findByRole("heading", { name: "Ice Rankings" })).toBeTruthy();
    expect(screen.getByText("Every ice chug time on record, ranked by personal best.")).toBeTruthy();

    const table = await screen.findByRole("table", { name: "Chuggers ranked by personal best" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(texts(rows)).toEqual([
      ["Tied-1", "Chugger A", "Team 3", "8.0s", "8.0s", "1"],
      ["Tied-1", "Chugger B", "Team 5", "8.0s", "8.0s", "1"],
      ["3", "Chugger D", "Team 9", "9.5s", "11.3s", "2"],
      ["4", "Chugger C", "Team 7", "10.0s", "10.0s", "2"],
    ]);
    expect(rows[3].className).toContain("xp-mine");
  });

  it("sorts on a header click and drills into a team", async () => {
    const open = vi.fn();
    renderView(open);
    const table = await screen.findByRole("table", { name: "Chuggers ranked by personal best" });

    fireEvent.click(within(table).getByRole("button", { name: "AVG" }));
    expect(texts(within(table).getAllByRole("row").slice(1)).map((r) => r[1])).toEqual(["Chugger A", "Chugger B", "Chugger C", "Chugger D"]);
    fireEvent.click(within(table).getByRole("button", { name: "AVG" }));
    expect(within(table).getAllByRole("row")[1].textContent).toContain("Chugger D");

    fireEvent.click(within(table).getByRole("button", { name: "Team 9" }));
    expect(open).toHaveBeenCalledWith({ kind: "team", rosterId: 9 });
  });

  it("ranks a week's chugs by time from the chips, latest week first", async () => {
    renderView();
    const latest = await screen.findByRole("table", { name: "Week 2 chugs ranked by time" });
    expect(texts(within(latest).getAllByRole("row").slice(1))).toEqual([["1", "Chugger D", "Team 9", "9.5s"]]);

    fireEvent.click(screen.getByRole("button", { name: "Week 1" }));
    expect(screen.getByRole("button", { name: "Week 1" }).getAttribute("aria-pressed")).toBe("true");
    const week1 = screen.getByRole("table", { name: "Week 1 chugs ranked by time" });
    expect(texts(within(week1).getAllByRole("row").slice(1)).map((r) => r[0])).toEqual(["Tied-1", "Tied-1", "Tied-3", "Tied-3", "5"]);
  });

  it("renders the same rankings as card rows for narrow widths", async () => {
    renderView();
    const cards = await screen.findByRole("list", { name: "Chuggers ranked by personal best" });
    const first = within(cards).getAllByRole("listitem")[2];
    expect(first.textContent).toContain("3");
    expect(first.textContent).toContain("Chugger D");
    expect(first.textContent).toContain("PR 9.5s · AVG 11.3s · 2 chugs");
  });

  it("shows the summary cards", async () => {
    renderView();
    const card = async (name: string) => (await screen.findByRole("region", { name })).textContent;
    expect(await card("Fastest ever")).toContain("8.0sChugger A, Week 1");
    expect(await card("League average")).toContain("9.8sover 6 chugs");
    expect(await card("Most improved")).toContain("-3.5sChugger D, 13.0s to 9.5s");
    expect(await card("Slowest average")).toContain("11.3sChugger D");
  });

  it("says so when nobody has a time yet", async () => {
    vi.mocked(getLedger).mockResolvedValue({ ...LEDGER, ices: LEDGER.ices.filter((i) => i.chugSeconds === undefined) });
    refreshLedger();
    renderView();
    expect(await screen.findByText(/No chug times yet/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
