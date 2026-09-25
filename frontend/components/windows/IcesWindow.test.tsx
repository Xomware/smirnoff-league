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
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));

import { DrillContext } from "@/components/views/drill-link";
import { getLedger, type Ledger, logChugTime } from "@/lib/api/ledger";
import { ApiError, getMe } from "@/lib/api/users";
import { listVideos, type Video } from "@/lib/api/videos";
import { TroubleProvider } from "@/lib/ices/use-trouble";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { refreshVideos } from "@/lib/videos/use-videos";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { IceLedger, IcesWindow } from "./IcesWindow";

const W1_TIMED = SCENARIO_LEDGER.ices[0];
const VIDEO: Video = {
  mediaId: "v1",
  iceIds: [W1_TIMED.iceId],
  week: 1,
  rosterIds: [W1_TIMED.rosterId],
  createdAt: "2026-09-19T12:00:00+00:00",
  bytes: 1,
  url: "https://media.test/v1.mp4",
};

// Two days before week 2's Sep 27 deadline, with two timed week 1 chugs.
const TIMED: Ledger = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices.map((ice, i) => (i === 0 ? { ...ice, chugSeconds: 9.1 } : i === 1 ? { ...ice, chugSeconds: 6.8, chugger: { name: "Ace" } } : ice)),
};

const narrow = (on: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: on && query === "(max-width: 639.98px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  stubSleeper();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T17:00:00Z"));
  vi.mocked(getLedger).mockResolvedValue(TIMED);
  vi.mocked(listVideos).mockResolvedValue([VIDEO]);
  refreshVideos();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);
const weekGroup = () => screen.findByRole("group", { name: "Week" });
const pressed = (group: HTMLElement) => within(group).getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
const pick = async (name: string) => fireEvent.click(within(await weekGroup()).getByRole("button", { name }));
const owes = () => within(screen.getByRole("region", { name: "Who owes" }));
const headings = () => [...document.querySelectorAll(".ledger h3")].map((h) => h.textContent);

describe("Ice Ledger week picker", () => {
  it("lists every week as a dot plus Season, on the week due next, with no filter selects", async () => {
    render(<IcesWindow />);
    const weeks = await weekGroup();
    expect(within(weeks).getAllByRole("button").map((b) => b.textContent)).toEqual(["W1", "W2", "W3 live", "Season"]);
    expect(pressed(weeks)).toEqual(["W2"]);
    expect(pressed(screen.getByRole("group", { name: "Status" }))).toEqual(["All"]);
    expect(within(screen.getByRole("group", { name: "Status" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Owed", "Late", "Paid"]);
    expect(screen.queryAllByRole("combobox")).toEqual([]);
    expect(document.querySelector("details")).toBeNull();
  });

  it("stays on the newest finalized week once its deadline passes", async () => {
    vi.setSystemTime(new Date("2026-09-28T18:00:00Z"));
    render(<IcesWindow />);
    expect(pressed(await weekGroup())).toEqual(["W2"]);
  });

  it("opens on the live week before any week has finalized", async () => {
    vi.mocked(getLedger).mockResolvedValue({ ...TIMED, weeks: TIMED.weeks.map((w) => ({ ...w, finalizedAt: null })) });
    render(<IcesWindow />);
    await screen.findByText(/no ices locked yet/i);
    expect(pressed(await weekGroup())).toEqual(["W3 live"]);
  });

  it("is one select on a phone, labelled with each week's deadline or live", async () => {
    narrow(true);
    render(<IcesWindow />);
    const select = (await screen.findByLabelText("Showing")) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Week 1", "Week 2 · due Sun 1 PM", "Week 3 · live", "Season"]);
    expect(select.value).toBe("2");
    expect(screen.queryByRole("group", { name: "Week" })).toBeNull();

    fireEvent.change(select, { target: { value: "season" } });
    expect(await screen.findByRole("region", { name: "Still owed" })).toBeTruthy();
  });

  it("falls back to Sleeper's provisional weeks with a warning when the ledger fails", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(500, "Internal error"));
    render(<IcesWindow />);

    expect((await screen.findByRole("note")).textContent).toMatch(/ledger unavailable \(internal error\)/i);
    expect(pressed(await weekGroup())).toEqual(["W3 live"]);
    expect(screen.getByText(/no ices locked yet/i)).toBeTruthy();

    await pick("W1");
    const week1 = screen.getByRole("region", { name: /^Week 1 · \d+ ices · provisional$/ });
    expect(within(week1).getByText("Romeo Doubs")).toBeTruthy();
    expect(within(week1).getByText("Lowest score")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Who owes" })).toBeNull();
  });
});

describe("Ice Ledger week view", () => {
  it("lists only the selected week's ices, late first in red, then by deadline with a countdown", async () => {
    render(<IcesWindow />);
    const rows = (await within(await screen.findByRole("region", { name: "Who owes" })).findByRole("list", { name: "Week 2 ices" })).querySelectorAll("li");
    expect([...rows].map((r) => r.getAttribute("data-level"))).toEqual(["late", "late", "late", "due", "due", "due"]);
    expect([...rows].map((r) => r.querySelector(".who-owes-due")!.textContent)).toEqual(["LATE", "LATE", "LATE", "2d 0h", "2d 0h", "2d 0h"]);
    expect(rows[0].textContent).toMatch(/Team 12.*W2 · late ice 1 · .*\(WR\).*due Sun 1 PM ET/);
    expect(rows[4].textContent).toMatch(/Team 13.*W2 · lowest score 82\.10 · due Sun 1 PM ET/);
    expect(owes().queryByText(/^W1 /)).toBeNull();
    expect(screen.getByRole("region", { name: "Week 2 · 3 ices · 0 done · 3 late" })).toBeTruthy();
  });

  it("ticks the countdown down to hours and then LATE by the day", async () => {
    vi.setSystemTime(new Date("2026-09-27T13:48:00Z"));
    const { unmount } = render(<IcesWindow />);
    await weekGroup();
    expect((await owes().findAllByText("3h 12m")).length).toBe(3);
    unmount();
    vi.setSystemTime(new Date("2026-09-28T18:00:00Z"));
    render(<IcesWindow />);
    await weekGroup();
    // Past the deadline the originals join their late rows.
    expect((await owes().findAllByText("LATE 1d")).length).toBe(6);
  });

  it("shows a paid row's chug time and plays its video in the player", async () => {
    render(<IcesWindow />);
    await pick("W1");
    const row = within(await owes().findByRole("list", { name: "Week 1 ices" }))
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("9.1s"))!;
    expect(row.getAttribute("data-level")).toBe("paid");
    fireEvent.click(await within(row).findByRole("button", { name: `Play Team ${W1_TIMED.rosterId} week 1 chug` }));
    const player = screen.getByRole("dialog", { name: `Team ${W1_TIMED.rosterId} · Week 1` });
    expect(player.querySelector("video")!.getAttribute("src")).toBe(`${VIDEO.url}#t=0.1`);
  });

  it("filters rows by the status chips", async () => {
    render(<IcesWindow />);
    await weekGroup();
    await owes().findByRole("list", { name: "Week 2 ices" });
    const chip = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name }));

    chip("Paid");
    expect(owes().getByText("No ices match.")).toBeTruthy();
    chip("Late");
    expect(owes().getAllByRole("listitem")).toHaveLength(3);
    chip("Owed");
    expect(owes().getAllByRole("listitem")).toHaveLength(6);
    await pick("W1");
    chip("Paid");
    expect(owes().getAllByRole("listitem")).toHaveLength(5);
  });

  it("opens a team's Ices tab from its name", async () => {
    const drill = vi.fn();
    render(
      <DrillContext value={drill}>
        <IcesWindow />
      </DrillContext>,
    );
    await weekGroup();
    const first = (await owes().findAllByRole("listitem"))[0];
    fireEvent.click(within(first).getByRole("button", { name: /Team 12/ }));
    expect(drill).toHaveBeenCalledWith({ kind: "team", rosterId: 12, tab: "ices" });
  });
});

describe("Ice Ledger season view", () => {
  it("lists what is still owed, late then by due date, every week newest first, then the summary", async () => {
    render(<IcesWindow />);
    await pick("Season");

    const owed = within(screen.getByRole("region", { name: "Still owed" }));
    expect([...document.querySelectorAll(".owe-group-title")].map((h) => h.textContent)).toEqual(["Late", "Due Sun, Sep 27 · 1 PM ET"]);
    expect(owed.getByRole("list", { name: "Late" }).querySelectorAll("li")).toHaveLength(3);
    expect(headings()).toEqual([
      "Still owed",
      "Week 3 — live, provisional",
      "Week 2 · 3 ices · 0 done · 3 late",
      "Week 1 · 5 ices · 5 done · 0 late",
      "Season summary",
    ]);
    expect(document.querySelector("details")).toBeNull();

    const summary = screen.getByRole("table", { name: "Season summary" });
    const [header, first] = within(summary).getAllByRole("row");
    expect(within(header).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["#", "Team", "Owed", "Completed", "Late", "Overdue"]);
    expect(cells(first)).toEqual(["1", expect.stringContaining("Team 13"), "2", "0", "2", "2"]);
    expect(within(screen.getByRole("region", { name: /^Week 1 ·/ })).getAllByText("Completed Sep 19")).toHaveLength(5);
  });

  it("says nobody owes when every ice is paid", async () => {
    vi.mocked(getLedger).mockResolvedValue({ ...TIMED, ices: TIMED.ices.filter((i) => i.status === "completed") });
    render(<IcesWindow />);
    await pick("Season");
    expect(within(screen.getByRole("region", { name: "Still owed" })).getByText("Nobody owes a chug. Suspicious.")).toBeTruthy();
  });

  it("keeps Glacier's trouble tags off the phone summary's names, as chart rows rather than a wide table", async () => {
    render(
      <TroubleProvider on>
        <IceLedger phone />
      </TroubleProvider>,
    );
    await pick("Season");
    const list = await screen.findByRole("list", { name: "Season summary" });
    await waitFor(() => expect(document.querySelector(".ledger-record .trouble-tag")).toBeTruthy());
    expect(list.querySelector(".trouble-tag")).toBeNull();
    expect(screen.queryByRole("table", { name: "Season summary" })).toBeNull();
    const first = within(list).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Team 13");
    expect([...first.querySelectorAll(":scope > .board-num")].map((n) => n.textContent)).toEqual(["2 owed", "0 done", "2 late", "2 overdue"]);
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
    await pick("W1");
    return within(await within(screen.getByRole("region", { name: /^Week 1 ·/ })).findByRole("list", { name: "Team 2 ices" }));
  };

  it("adds a time to my completed ice only, from a small dialog", async () => {
    vi.mocked(logChugTime).mockResolvedValue({ ...SCENARIO_LEDGER.ices[0], chugSeconds: 9.4 });
    const mine = await renderMine();
    const theirs = within(within(screen.getByRole("region", { name: /^Week 1 ·/ })).getByRole("list", { name: "Team 6 ices" }));
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
