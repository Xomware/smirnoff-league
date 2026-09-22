import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import IcesPage from "./page";

beforeEach(stubSleeper);
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ice Ledger page", () => {
  it("ranks owed ices, provisional, and names who caused each weekly ice", async () => {
    render(<IcesPage />);

    const board = await screen.findByRole("table", { name: /owed — provisional/i });
    expect(within(board).getByText("Team 6").closest("tr")?.textContent).toContain("x2");
    expect(within(board).getAllByRole("row")[1].textContent).toContain("x2");

    const week1 = screen.getByRole("region", { name: "Week 1" });
    expect(within(week1).getByText("Romeo Doubs")).toBeTruthy();
    expect(within(week1).getByText("Lowest score")).toBeTruthy();

    const live = screen.getByRole("region", { name: /week 3 — live, provisional/i });
    expect(within(live).getByText(/no games played yet/i)).toBeTruthy();
  });
});
