import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { getLedger, type Ledger } from "@/lib/api/ledger";
import { refreshLedger } from "@/lib/ices/use-ledger";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { AwardsView } from "./awards-view";
import { DrillContext } from "./drill-link";

// W1's first ice was chugged in 7.5s by a named chugger.
const TIMED: Ledger = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices.map((ice, i) => (i === 0 ? { ...ice, chugSeconds: 7.5, chugger: { name: "Speedy" } } : ice)),
};

beforeEach(() => {
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(TIMED);
  refreshLedger();
});
afterEach(() => vi.restoreAllMocks());

const renderView = (params = {}, open = vi.fn()) =>
  render(
    <DrillContext.Provider value={open}>
      <AwardsView params={params} />
    </DrillContext.Provider>,
  );

const card = (grid: HTMLElement, title: string) => within(grid).getByRole("heading", { name: title }).closest("li")!;

describe("Weekly Awards", () => {
  it("opens on the latest final week with every award's winner, stat and line", async () => {
    renderView();

    const grid = await screen.findByRole("list", { name: "Week 2 awards" });
    expect(screen.getByRole("button", { name: "Week 2" }).getAttribute("aria-pressed")).toBe("true");
    expect(card(grid, "Top Score").textContent).toContain("182.68 pts");
    expect(card(grid, "Biggest Blowout").textContent).toMatch(/67\.70 pts.*Team 1.*Beat Team 6 by 67\.70/);
    expect(card(grid, "Ice King").textContent).toMatch(/2 ices.*Team 13/);
    expect(card(grid, "Fastest Chug").textContent).toContain("No winner this week.");
  });

  it("switches weeks, and links a winner to their team", async () => {
    const open = vi.fn();
    renderView({}, open);

    fireEvent.click(await screen.findByRole("button", { name: "Week 1" }));
    const grid = screen.getByRole("list", { name: "Week 1 awards" });
    expect(card(grid, "Top Score").textContent).toMatch(/182\.70 pts.*Team 14/);
    expect(card(grid, "Fastest Chug").textContent).toMatch(/7\.5s.*Speedy downed it in 7\.5s/);

    fireEvent.click(within(card(grid, "Closest Escape")).getByRole("button", { name: /Team 2/ }));
    expect(open).toHaveBeenCalledWith({ kind: "team", rosterId: 2 });
  });

  it("opens the week a link names", async () => {
    renderView({ week: 1 });
    expect(await screen.findByRole("list", { name: "Week 1 awards" })).toBeTruthy();
  });

  it("tallies the season's winners per award", async () => {
    renderView();

    const leaders = await screen.findByRole("list", { name: "Most wins by award" });
    const row = (label: string) => within(leaders).getByText(label).closest("li")!.textContent;
    expect(row("Top Score")).toMatch(/Team 1, Team 14\s*1 win each/);
    expect(row("Ice King")).toMatch(/Team 6, Team 13\s*1 win each/);
    expect(row("Fastest Chug")).toMatch(/Team \d+\s*1 win$/);
    expect(screen.getByText(/^Most hardware:/)).toBeTruthy();
  });

  it("gives the Sleeper awards and says why the ice ones are missing without the ledger", async () => {
    vi.mocked(getLedger).mockRejectedValue(new Error("API not configured"));
    refreshLedger();
    renderView();

    const grid = await screen.findByRole("list", { name: "Week 2 awards" });
    expect(screen.getByText(/need the ledger, which is unavailable \(API not configured\)/)).toBeTruthy();
    expect(card(grid, "Top Score").textContent).toContain("Team 1");
    expect(card(grid, "Ice King").textContent).toContain("No winner this week.");
  });

  it("says so before any week is final", async () => {
    vi.mocked(getLedger).mockResolvedValue({ ...TIMED, weeks: [] });
    refreshLedger();
    renderView();

    expect(await screen.findByText(/No week is final yet/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Week" })).toBeNull();
  });
});
