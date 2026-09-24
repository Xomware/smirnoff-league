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
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));

import { getLedger } from "@/lib/api/ledger";
import { ApiError, getMe } from "@/lib/api/users";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { listVideos, type Video } from "@/lib/api/videos";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";
import { DrillContext, type DrillTarget } from "./drill-link";
import { IcesOverview } from "./ices-overview";

const TIMED: typeof SCENARIO_LEDGER = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices.map((ice, i) => (i === 1 ? { ...ice, chugSeconds: 6.8, chugger: { name: "Ace" } } : ice)),
};

// Four week 1 chugs, one a day, the oldest timed.
const video = (n: number): Video => ({
  mediaId: `v${n}`,
  iceIds: [TIMED.ices[n].iceId],
  week: 1,
  rosterIds: [TIMED.ices[n].rosterId],
  createdAt: `2026-09-2${n}T12:00:00Z`,
  bytes: 1,
  url: `https://v/${n}.mp4`,
});
const VIDEOS = [1, 2, 3, 4].map(video);
const clipLabel = (n: number) => `Watch Team ${TIMED.ices[n].rosterId} · Week 1 chug`;

const phone = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

function renderOverview(open = vi.fn<(to: DrillTarget) => void>()) {
  const { container } = render(
    <DrillContext value={open}>
      <IcesOverview />
    </DrillContext>,
  );
  return { open, container };
}

const block = (name: string) => within(screen.getByRole("region", { name }));

beforeEach(() => {
  stubSleeper();
  phone(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T17:00:00Z"));
  vi.mocked(getLedger).mockResolvedValue(TIMED);
  vi.mocked(listVideos).mockResolvedValue(VIDEOS);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Ices overview", () => {
  it("renders its blocks in order, each with a See all to its full page", async () => {
    const { open, container } = renderOverview();
    await screen.findByRole("list", { name: "Recent chugs" });

    const titles = [...container.querySelectorAll(".ov-head h3")].map((e) => e.textContent);
    expect(titles).toEqual(["Season at a glance", "Who owes now", "Week 3 — live, provisional", "Recent chugs", "Ice leaders", "Heat check"]);

    for (const name of ["Who owes now", "Week 3 — live, provisional", "Recent chugs", "Ice leaders", "Heat check"]) {
      fireEvent.click(block(name).getByRole("button", { name: `See all ${name}` }));
    }
    expect(open.mock.calls.map(([to]) => to)).toEqual([
      { kind: "ices" },
      { kind: "watch" },
      { kind: "videos" },
      { kind: "ice-standings" },
      { kind: "stats" },
    ]);
  });

  it("fills each block from the ledger, the season tally and the videos", async () => {
    renderOverview();
    const clips = await screen.findByRole("list", { name: "Recent chugs" });

    expect(block("Season at a glance").getByText("Owed now").closest("li")!.textContent).toContain("6");
    const owes = block("Who owes now").getByRole("list", { name: "Who owes now" });
    expect([...owes.children].map((t) => t.textContent?.match(/Team \d+/)?.[0])).toEqual(["Team 13", "Team 12"]);
    expect(block("Week 3 — live, provisional").getByText(/no ices locked yet/i)).toBeTruthy();

    const shown = within(clips).getAllByRole("button");
    expect(shown.map((b) => b.getAttribute("aria-label"))).toEqual([4, 3, 2].map(clipLabel));

    const leaders = within(block("Ice leaders").getByRole("list", { name: "Ice leaders" })).getAllByRole("listitem");
    expect(leaders.length).toBeGreaterThan(0);
    expect(leaders.length).toBeLessThanOrEqual(5);
    expect(leaders[0].textContent).toContain("Team 13");

    const heat = within(block("Heat check").getByRole("list", { name: "Most likely to ice next" })).getAllByRole("listitem");
    expect(heat.length).toBeGreaterThan(0);
    expect(heat.length).toBeLessThanOrEqual(3);
  });

  it.each([
    ["STATUS_SCHEDULED", false],
    ["STATUS_IN_PROGRESS", true],
  ])("counts the live week's empty slot only once every game has kicked off (%s)", async (status, locked) => {
    // Week 3 replays W1 with roster 3's QB slot empty.
    const week3 = golden.weeks[0].matchups.map((m) => (m.roster_id === 3 ? { ...m, starters: ["0", ...m.starters!.slice(1)] } : m));
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("espn.com")) return jsonResponse({ events: [espnEvent({ home: "BUF", away: "MIA", status })] });
      if (url.endsWith("/matchups/3")) return jsonResponse(week3);
      return sleeper(input, init);
    });
    renderOverview();
    await screen.findByRole("list", { name: "Recent chugs" });

    const live = block("Week 3 — live, provisional");
    expect(live.queryByText(/no ices locked yet/i) === null).toBe(locked);
    expect(live.queryByText("Empty slot") !== null).toBe(locked);
  });

  it("counts what the long blocks hold in their headers", async () => {
    renderOverview();
    await screen.findByRole("list", { name: "Recent chugs" });
    expect(block("Who owes now").getByText("2 teams").closest(".ov-head")).toBeTruthy();
    expect(block("Recent chugs").getByText("4 on tape").closest(".ov-head")).toBeTruthy();
  });

  it("counts the stat strip from the ledger", async () => {
    renderOverview();
    const strip = within(await screen.findByRole("region", { name: "Season at a glance" }));
    const stat = (label: string) => strip.getByText(label).closest("li")!.textContent;

    expect(stat("Owed now")).toContain("6");
    expect(stat("Late")).toContain("3");
    expect(stat("Completed")).toContain("5");
    expect(stat("Next deadline")).toContain("2d 0h");
    expect(stat("Fastest chug")).toMatch(/6\.8s.*Ace/);
    expect(strip.getByRole("button", { name: /Fastest chug/ })).toBeTruthy();
  });

  it("groups who owes by team, with each ice's due time and an upload on my own team only", async () => {
    vi.mocked(getMe).mockResolvedValue({ sub: "s", email: "e", isAdmin: false, profile: { name: "P", username: "p", rosterId: 13, createdAt: "", updatedAt: "" } });
    render(
      <ProfileProvider>
        <IcesOverview />
      </ProfileProvider>,
    );
    const owes = await screen.findByRole("list", { name: "Who owes now" });
    const teams = [...owes.children] as HTMLElement[];
    expect(teams.map((t) => t.textContent?.match(/Team \d+/)?.[0])).toEqual(["Team 13", "Team 12"]);
    const mine = within(teams[0]).getByRole("list", { name: "Team 13 owed ices" });
    expect(within(mine).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/W2.*due in 2d 0h/),
      expect.stringMatching(/W2.*due in 2d 0h/),
      expect.stringMatching(/W2.*Late ice.*LATE/),
      expect.stringMatching(/W2.*Late ice.*LATE/),
    ]);
    expect(await within(teams[0]).findByRole("button", { name: "Upload chug" })).toBeTruthy();
    expect(within(teams[1]).queryByRole("button", { name: "Upload chug" })).toBeNull();
  });

  it("falls back to the provisional Sleeper tally when the ledger fails", async () => {
    vi.mocked(getLedger).mockRejectedValue(new ApiError(500, "Internal error"));
    renderOverview();

    const board = await screen.findByRole("table", { name: /owed — provisional/i });
    expect(within(board).getByText("Team 6").closest("tr")?.textContent).toContain("x2");
    expect(within(board).getByText("Team 13").closest("tr")?.textContent).toContain("2 ices this season");
    expect(screen.queryByRole("region", { name: "Season at a glance" })).toBeNull();
  });

  it("opens the player from a recent chug", async () => {
    renderOverview();
    fireEvent.click(await screen.findByRole("button", { name: clipLabel(4) }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("trims to a stat grid, three owing teams and three tiles on a phone", async () => {
    phone(true);
    vi.mocked(getLedger).mockResolvedValue({ ...TIMED, ices: TIMED.ices.map((i) => ({ ...i, status: "owed" as const })) });
    const { open } = renderOverview();
    const tiles = await screen.findByRole("list", { name: "More from the ices" });

    expect(screen.queryByText("Completed")).toBeNull();
    const owes = block("Who owes now").getByRole("list", { name: "Who owes now" });
    expect(owes.children).toHaveLength(3);
    fireEvent.click(block("Who owes now").getByRole("button", { name: "See all 5" }));
    expect(owes.children).toHaveLength(5);

    expect(screen.queryByRole("region", { name: /live, provisional/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Recent chugs" })).toBeNull();

    const links = within(tiles).getAllByRole("button");
    expect(links.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Recent chugs/),
      expect.stringMatching(/^Ice leaders/),
      expect.stringMatching(/^Heat check/),
    ]);
    links.forEach((b) => fireEvent.click(b));
    expect(open.mock.calls.map(([to]) => to)).toEqual([{ kind: "videos" }, { kind: "ice-standings" }, { kind: "stats" }]);
  });
});
