import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  listWriteups: vi.fn(),
}));

import { getLedger } from "@/lib/api/ledger";
import { ApiError } from "@/lib/api/users";
import { listWriteups } from "@/lib/api/writeups";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { NewsWindow } from "./NewsWindow";

beforeEach(() => {
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(listWriteups).mockResolvedValue([
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
    expect(screen.getByRole("button", { name: "News drop: Week 2 in review" })).toBeTruthy();
  });

  it("filters by type and by team, with the count and chips following", async () => {
    render(<NewsWindow />);
    await rows();
    const type = screen.getByLabelText("Type") as HTMLSelectElement;
    expect([...type.options].map((o) => o.textContent)).toEqual(["All", "Ices", "Chugs", "Roster moves", "Trades", "News drops"]);
    const all = (await rows()).length;
    expect(screen.getByRole("status").textContent).toBe(`${all} items`);

    fireEvent.change(type, { target: { value: "chugs" } });
    const chugs = texts(await rows());
    expect(chugs).toHaveLength(5);
    expect(chugs.every((t) => t.includes("chugs a Week 1 ice"))).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("5 items");

    fireEvent.change(type, { target: { value: "moves" } });
    expect(texts(await rows())).toHaveLength(2);
    fireEvent.change(type, { target: { value: "drops" } });
    expect(texts(await rows())).toEqual([expect.stringContaining("News drop: Week 2 in review")]);

    fireEvent.change(type, { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "6" } });
    const team6 = texts(await rows());
    expect(team6.length).toBeGreaterThan(0);
    expect(team6.every((t) => t.includes("Team 6"))).toBe(true);
    expect(screen.getByRole("button", { name: "Remove Team: Team 6" })).toBeTruthy();
  });

  it("says when nothing matches and clears the filters", async () => {
    render(<NewsWindow />);
    await rows();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "trades" } });
    expect(await rows()).toHaveLength(0);
    expect(screen.getByText("No news matches these filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((await rows()).length).toBeGreaterThan(5);
  });

  it("still shows transactions when the ledger and write-ups are unavailable", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(0, "API not configured"));
    vi.mocked(listWriteups).mockRejectedValue(new ApiError(0, "API not configured"));
    render(<NewsWindow />);

    expect(texts(await rows())).toHaveLength(2);
    expect(screen.getByRole("note").textContent).toMatch(/ice events and news drops are unavailable/i);
  });
});
