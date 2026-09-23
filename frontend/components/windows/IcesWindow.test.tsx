import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { getLedger } from "@/lib/api/ledger";
import { ApiError } from "@/lib/api/users";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { IcesWindow } from "./IcesWindow";

beforeEach(stubSleeper);
afterEach(() => {
  vi.restoreAllMocks();
});

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("Ice Ledger window", () => {
  it("falls back to the provisional Sleeper tally with a warning when the ledger fails", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(500, "Internal error"));
    render(<IcesWindow />);

    const board = await screen.findByRole("table", { name: /owed — provisional/i });
    expect(within(board).getByText("Team 6").closest("tr")?.textContent).toContain("x2");
    expect(within(board).getAllByRole("row")[1].textContent).toContain("x2");
    expect(within(board).getByText("Team 13").closest("tr")?.textContent).toContain("2 ices this season");
    expect(screen.getByRole("note").textContent).toMatch(/ledger unavailable \(internal error\)/i);

    const week1 = screen.getByRole("region", { name: "Week 1 — provisional" });
    expect(within(week1).getByText("Romeo Doubs")).toBeTruthy();
    expect(within(week1).getByText("Lowest score")).toBeTruthy();

    const live = screen.getByRole("region", { name: /week 3 — live, provisional/i });
    expect(within(live).getByText(/no empty slots this week/i)).toBeTruthy();
  });

  it("shows W1 completed, W2 owed with late rows, and the season summary from the ledger", async () => {
    vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
    render(<IcesWindow />);

    const summary = await screen.findByRole("table", { name: "Season summary" });
    expect(screen.queryByRole("table", { name: /provisional/i })).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    const [header, first] = within(summary).getAllByRole("row");
    expect(within(header).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "#",
      "Team",
      "Owed",
      "Completed",
      "Late",
      "Overdue",
    ]);
    expect(cells(first)).toEqual(["1", expect.stringContaining("Team 13"), "2", "0", "2", "2"]);

    const week1 = screen.getByRole("region", { name: "Week 1" });
    expect(within(week1).getAllByText("Completed Sep 19")).toHaveLength(5);
    expect(within(week1).queryByText("Owed")).toBeNull();

    const week2 = screen.getByRole("region", { name: "Week 2" });
    expect(within(week2).getAllByText("Owed")).toHaveLength(6);
    const team13 = within(week2).getByRole("list", { name: "Team 13 ices" });
    expect(within(team13).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Lowest score"),
      expect.stringContaining("Late ice 1"),
      expect.stringContaining("4983"),
      expect.stringContaining("Late ice 1"),
    ]);

    const lateCard = screen.getByRole("region", { name: "Late Ices" });
    expect(within(lateCard).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/Team 13.*2/),
      expect.stringMatching(/Team 12.*1/),
    ]);

    expect(screen.getByRole("region", { name: /week 3 — live, provisional/i })).toBeTruthy();
  });
});
