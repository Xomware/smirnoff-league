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
      ["T1Tied for 1st", "Chugger A", "Team 3", "8.0s", "8.0s", "1"],
      ["T1Tied for 1st", "Chugger B", "Team 5", "8.0s", "8.0s", "1"],
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
    expect(texts(within(week1).getAllByRole("row").slice(1)).map((r) => r[0])).toEqual([
      "T1Tied for 1st",
      "T1Tied for 1st",
      "T3Tied for 3rd",
      "T3Tied for 3rd",
      "5",
    ]);
  });

  it("renders narrow widths as chart rows: rank, name, then PR, AVG and count columns", async () => {
    renderView();
    const list = await screen.findByRole("list", { name: "Chuggers ranked by personal best" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => [...li.querySelectorAll(".board-num")].map((n) => n.textContent))).toEqual([
      ["PR 8.0s", "average 8.0s", "1 chug"],
      ["PR 8.0s", "average 8.0s", "1 chug"],
      ["PR 9.5s", "average 11.3s", "2 chugs"],
      ["PR 10.0s", "average 10.0s", "2 chugs"],
    ]);
    // Every number sits in a column on the row itself, never on a stacked line of its own.
    for (const li of items) expect([...li.children].map((c) => c.className.split(" ")[0])).toEqual(["rank-label", "board-who", "board-num", "board-num", "board-num"]);
    expect(within(items[0]).getByText("T1").getAttribute("aria-hidden")).toBe("true");
    expect(within(items[0]).getByText("Tied for 1st").className).toBe("sr-only");
    expect(items[2].querySelector(".rank-label")?.textContent).toBe("3");
    const head = list.parentElement?.querySelector(".board-head");
    expect(head?.getAttribute("aria-hidden")).toBe("true");
    expect([...(head?.children ?? [])].map((c) => c.textContent)).toEqual(["RK", "Chugger", "PR", "AVG", "#"]);
  });

  it("shows a team line only when it differs from the chugger's name", async () => {
    const unnamed: LedgerIce = { ...timed("W02#R11#S1", 2, 11, 12, "x"), chugger: undefined };
    const self: LedgerIce = timed("W02#R12#S1", 2, 12, 14, "Team 12");
    vi.mocked(getLedger).mockResolvedValue({ ...LEDGER, ices: [...LEDGER.ices, unnamed, self] });
    refreshLedger();
    renderView();
    const list = await screen.findByRole("list", { name: "Chuggers ranked by personal best" });
    const row = (name: string) => within(list).getAllByRole("listitem").find((li) => li.querySelector(".board-name")?.textContent === name);
    expect(row("Chugger D")?.querySelector(".board-sub")?.textContent).toBe("Team 9");
    expect(row("Team 11")?.querySelector(".board-sub")).toBeNull();
    expect(row("Team 12")?.querySelector(".board-sub")).toBeNull();
    expect(within(list).getAllByText("Team 11")).toHaveLength(1);
  });

  it("draws a bar per row scaled to PR, fastest widest, with #1 marked", async () => {
    renderView();
    const list = await screen.findByRole("list", { name: "Chuggers ranked by personal best" });
    const bars = [...list.querySelectorAll<HTMLElement>(".board-bar")];
    expect(bars.map((b) => b.style.getPropertyValue("--bar"))).toEqual(["100%", "100%", "36%", "15%"]);
    expect(bars.every((b) => b.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(bars.map((b) => b.classList.contains("board-bar-top"))).toEqual([true, true, false, false]);

    const table = screen.getByRole("table", { name: "Chuggers ranked by personal best" });
    expect([...table.querySelectorAll<HTMLElement>(".board-bar")].map((b) => b.style.getPropertyValue("--bar"))).toEqual(["100%", "100%", "36%", "15%"]);
  });

  it("renders a week as chart rows: rank, name and time, with bars", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Week 1" }));
    const list = screen.getByRole("list", { name: "Week 1 chugs ranked by time" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => [li.querySelector(".rank-label")?.textContent, li.querySelector(".board-name")?.textContent, li.querySelector(".board-num")?.textContent])).toEqual([
      ["T1Tied for 1st", "Chugger A", "8.0s"],
      ["T1Tied for 1st", "Chugger B", "8.0s"],
      ["T3Tied for 3rd", "Chugger C", "10.0s"],
      ["T3Tied for 3rd", "Chugger C", "10.0s"],
      ["5", "Chugger D", "13.0s"],
    ]);
    expect([...list.querySelectorAll<HTMLElement>(".board-bar")].map((b) => b.style.getPropertyValue("--bar"))).toEqual(["100%", "100%", "66%", "66%", "15%"]);
    expect([...(list.parentElement?.querySelector(".board-head")?.children ?? [])].map((c) => c.textContent)).toEqual(["RK", "Chugger", "Time"]);
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
