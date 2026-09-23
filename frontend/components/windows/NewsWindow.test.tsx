import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  getWriteups: vi.fn(),
}));

import { getLedger } from "@/lib/api/ledger";
import { ApiError } from "@/lib/api/users";
import { getWriteups } from "@/lib/api/writeups";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { NewsWindow } from "./NewsWindow";

beforeEach(() => {
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getWriteups).mockResolvedValue([
    { mediaId: "W02#abc", week: 2, title: "Week 2 in review", publishedAt: "2026-09-16T12:00:00+00:00", pages: [] },
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const rows = async () => within(await screen.findByRole("list", { name: "League news" })).queryAllByRole("listitem");
const texts = (items: HTMLElement[]) => items.map((li) => li.textContent ?? "");

describe("News window", () => {
  it("shows W3's free-agent adds with player names and the W1 ices", async () => {
    render(<NewsWindow />);
    const items = texts(await rows());

    expect(items[0]).toContain("Team 2 picks up D. Waller, drops P. 7553");
    expect(items[0]).toContain("W3");
    expect(items[1]).toContain("Team 6 picks up R. Bateman, drops A. Pierce");

    const w1Iced = items.filter((t) => t.includes("gets iced") && t.includes("W1"));
    expect(w1Iced).toHaveLength(5);
    expect(w1Iced.some((t) => t.includes("R. Doubs put up 0.00 at WR"))).toBe(true);
    expect(w1Iced.some((t) => t.includes("lowest score of the week"))).toBe(true);
    expect(items.filter((t) => t.includes("chugs a Week 1 ice"))).toHaveLength(5);
    expect(items.some((t) => t.includes("News drop: Week 2 in review"))).toBe(true);
  });

  it("filters by type and by team", async () => {
    render(<NewsWindow />);
    await rows();

    fireEvent.click(screen.getByRole("button", { name: "Trades" }));
    expect(await rows()).toHaveLength(0);
    expect(screen.getByText(/no trades yet/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(texts(await rows())).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "6" } });
    const team6 = texts(await rows());
    expect(team6.length).toBeGreaterThan(0);
    expect(team6.every((t) => t.includes("Team 6"))).toBe(true);
  });

  it("still shows transactions when the ledger and write-ups are unavailable", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(0, "API not configured"));
    vi.mocked(getWriteups).mockRejectedValue(new ApiError(0, "API not configured"));
    render(<NewsWindow />);

    expect(texts(await rows())).toHaveLength(2);
    expect(screen.getByRole("note").textContent).toMatch(/ice events and news drops are unavailable/i);
  });
});
