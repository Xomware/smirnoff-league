import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
  logChugTime: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { getLedger, logChugTime } from "@/lib/api/ledger";
import { ApiError, getMe } from "@/lib/api/users";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { IceLedger, IcesWindow } from "./IcesWindow";

beforeEach(stubSleeper);
afterEach(() => {
  vi.restoreAllMocks();
});

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("Ice Ledger window", () => {
  it("falls back to the provisional Sleeper tally with a warning when the ledger fails", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(500, "Internal error"));
    render(<IcesWindow />);

    expect((await screen.findByRole("note")).textContent).toMatch(/ledger unavailable \(internal error\)/i);
    expect(screen.queryByRole("table", { name: /owed — provisional/i })).toBeNull();

    const week1 = pastWeek(1);
    expect(within(week1).getByText(/^Week 1 · \d+ ices · provisional$/)).toBeTruthy();
    expect(within(week1).getByText("Romeo Doubs")).toBeTruthy();
    expect(within(week1).getByText("Lowest score")).toBeTruthy();

    expect(within(pastWeek(3)).getByText(/no ices locked yet/i)).toBeTruthy();
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

    const week1 = pastWeek(1);
    expect(within(week1).getAllByText("Completed Sep 19")).toHaveLength(5);
    expect(within(week1).queryByText("Owed")).toBeNull();

    const week2 = pastWeek(2);
    expect(within(week2).getAllByText("Owed")).toHaveLength(6);
    const team13 = within(week2).getByRole("list", { name: "Team 13 ices" });
    expect(within(team13).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Lowest score"),
      expect.stringContaining("Late ice 1"),
      expect.stringContaining("4983"),
      expect.stringContaining("Late ice 1"),
    ]);

    expect(pastWeek(3)).toBeTruthy();
  });
});

// Two days before week 2's Sep 27 deadline, with two timed week 1 chugs.
const TIMED: typeof SCENARIO_LEDGER = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices.map((ice, i) => (i === 0 ? { ...ice, chugSeconds: 9.1 } : i === 1 ? { ...ice, chugSeconds: 6.8, chugger: { name: "Ace" } } : ice)),
};
const pastWeek = (week: number) => screen.getByText(new RegExp(`^Week ${week} [·—]`)).closest("details")!;

describe("Ice Ledger layout", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T17:00:00Z"));
    vi.mocked(getLedger).mockResolvedValue(TIMED);
  });
  afterEach(() => vi.useRealTimers());

  it("is only the record: every week newest first, then the season summary", async () => {
    const { container } = render(<IcesWindow />);
    await screen.findByRole("table", { name: "Season summary" });

    const titles = [...container.querySelectorAll(".xp-group-title, summary")].map((e) => e.textContent);
    expect(titles).toEqual(["Week 3 — live, provisional", expect.stringMatching(/^Week 2 ·/), expect.stringMatching(/^Week 1 ·/), "Season summary"]);
    expect(screen.queryByRole("region", { name: "Season at a glance" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Who owes now" })).toBeNull();
  });

  it("opens only the newest week, and each summary toggles its week", async () => {
    render(<IcesWindow />);
    await screen.findByRole("table", { name: "Season summary" });
    expect(pastWeek(3).open).toBe(true);
    expect(pastWeek(2).open).toBe(false);
    expect(pastWeek(1).open).toBe(false);
    expect(screen.getByText(/^Week 2 ·/).textContent).toBe("Week 2 · 3 ices · 0 done · 3 late");
    expect(screen.getByText(/^Week 1 ·/).textContent).toBe("Week 1 · 5 ices · 5 done · 0 late");

    fireEvent.click(screen.getByText(/^Week 1 ·/));
    expect(pastWeek(1).open).toBe(true);
    fireEvent.click(screen.getByText(/^Week 3 —/));
    expect(pastWeek(3).open).toBe(false);
  });

  it("folds the season summary away on the phone only, as stacked rows rather than a wide table", async () => {
    const { unmount } = render(<IceLedger phone />);
    const list = await screen.findByRole("list", { name: "Season summary" });
    expect(list.closest("details")!.open).toBe(false);
    expect(screen.queryByRole("table", { name: "Season summary" })).toBeNull();
    expect(list.closest(".xp-table-scroll")).toBeNull();
    const first = within(list).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Team 13");
    const stats = [...first.querySelectorAll("dt")].map((dt) => `${dt.textContent} ${dt.nextElementSibling?.textContent}`);
    expect(stats).toEqual(["Owed 2", "Done 0", "Late 2", "Overdue 2"]);
    unmount();
    render(<IcesWindow />);
    expect((await screen.findByRole("table", { name: "Season summary" })).closest("details")!.open).toBe(true);
  });
});

describe("Ice Ledger chug times", () => {
  const renderMine = async () => {
    vi.mocked(getMe).mockResolvedValue({ sub: "s", email: "e", isAdmin: false, profile: { name: "P", username: "p", rosterId: 2, createdAt: "", updatedAt: "" } });
    vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
    render(
      <ProfileProvider>
        <IcesWindow />
      </ProfileProvider>,
    );
    fireEvent.click(await screen.findByText(/^Week 1 ·/));
    return within(await within(pastWeek(1)).findByRole("list", { name: "Team 2 ices" }));
  };

  it("adds a time to my completed ice only, from a small dialog", async () => {
    vi.mocked(logChugTime).mockResolvedValue({ ...SCENARIO_LEDGER.ices[0], chugSeconds: 9.4 });
    const mine = await renderMine();
    const theirs = within(within(pastWeek(1)).getByRole("list", { name: "Team 6 ices" }));
    expect(theirs.queryByRole("button", { name: "Add time" })).toBeNull();

    fireEvent.click(await mine.findByRole("button", { name: "Add time" }));
    const dialog = screen.getByRole("dialog", { name: "Chug time" });
    fireEvent.change(within(dialog).getByLabelText("How long did it take?"), { target: { value: "9.4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save time" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Chug time" })).toBeNull());
    expect(logChugTime).toHaveBeenCalledWith(SCENARIO_LEDGER.ices.find((i) => i.rosterId === 2)!.iceId, 9.4);
  });

  it("keeps the dialog open with the server's message when the save fails", async () => {
    vi.mocked(logChugTime).mockRejectedValue(new ApiError(403, "That ice is not on your roster"));
    const mine = await renderMine();

    fireEvent.click(await mine.findByRole("button", { name: "Add time" }));
    const dialog = screen.getByRole("dialog", { name: "Chug time" });
    fireEvent.change(within(dialog).getByLabelText("How long did it take?"), { target: { value: "9.4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save time" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("The time didn't save (That ice is not on your roster).");
  });
});
