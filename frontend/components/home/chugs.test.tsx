import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { getMe, type Me } from "@/lib/api/users";
import type { Video } from "@/lib/api/videos";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { stubSleeper } from "@/lib/test/league-mock";
import type { VideosState } from "@/lib/videos/use-videos";
import { ChugBoard } from "./ChugBoard";
import { ChugReel, REEL_MS } from "./ChugReel";
import { DueWarning } from "./DueWarning";

const ice = (over: Partial<LedgerIce>): LedgerIce => ({ iceId: "W02#R4#0", week: 2, rosterId: 4, reason: "zero", status: "owed", ...over });

// W2's deadline is Sun 2026-09-27 13:00 ET (17:00Z).
const LEDGER: Ledger = {
  ices: [
    ice({ iceId: "W01#R4#0", week: 1, status: "completed", videoId: "v1" }),
    ice({}),
    ice({ iceId: "W02#R4#1", reason: "lowest" }),
    ice({ iceId: "W02#R7#0", rosterId: 7 }),
    ice({ iceId: "W02#R9#0", rosterId: 9, status: "completed" }),
  ],
  weeks: [
    { week: 1, finalizedAt: "2026-09-15T08:00:00+00:00", deadlineUtc: "2026-09-20T17:00:00+00:00" },
    { week: 2, finalizedAt: "2026-09-22T08:00:00+00:00", deadlineUtc: "2026-09-27T17:00:00+00:00" },
  ],
  summary: [],
};

const clip = (n: number, over: Partial<Video> = {}): Video => ({
  mediaId: `v${n}`,
  iceIds: [`W02#R${n}#0`],
  week: 2,
  rosterIds: [n],
  createdAt: `2026-09-2${n}T12:00:00+00:00`,
  bytes: 1,
  url: `https://media.test/${n}.mp4`,
  ...over,
});

const me = (rosterId: number): Me => ({ sub: "s", email: "e", profile: { name: "N", username: "u", rosterId, createdAt: "", updatedAt: "" }, isAdmin: false });

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  stubSleeper();
  vi.mocked(getMe).mockResolvedValue(me(4));
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  reducedMotion(false);
});

const ticked = () =>
  (within(within(screen.getByRole("dialog", { name: "Upload chug" })).getByRole("group", { name: "Your ices" })).getAllByRole("checkbox") as HTMLInputElement[])
    .filter((box) => box.checked)
    .map((box) => box.value);

const board = (videos: Video[] = [clip(1, { mediaId: "v1", iceIds: ["W01#R4#0"], week: 1, rosterIds: [4] })]) =>
  render(
    <ProfileProvider>
      <ChugBoard ledger={LEDGER} videos={videos} onVideoError={() => {}} />
    </ProfileProvider>,
  );

describe("Chug Board", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T22:00:00Z"));
  });

  it("groups ices by team, owing teams first, and plays a done chug", () => {
    board();
    const teams = within(screen.getByRole("list", { name: "Chug Board" })).getAllByRole("list");
    expect(teams.map((l) => l.getAttribute("aria-label"))).toEqual(["Team 4 chugs", "Team 7 chugs", "Team 9 chugs"]);

    const owed = within(teams[0]).getAllByRole("listitem").filter((li) => li.classList.contains("chug-owed"));
    expect(owed.map((li) => li.querySelector(".chug-countdown")?.textContent)).toEqual(["due in 1d 19h", "due in 1d 19h"]);
    expect(within(teams[2]).getByText("Done")).toBeTruthy();

    const play = within(teams[0]).getByRole("button", { name: "Play Team 4 · Week 1 chug" });
    const video = play.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("https://media.test/1.mp4#t=0.1");
    expect(video.getAttribute("preload")).toBe("metadata");
    fireEvent.click(play);
    expect(screen.getByRole("dialog", { name: "Team 4 · Week 1" })).toBeTruthy();
  });

  it("puts Upload chug only on my rows, preselecting the ice", async () => {
    board();
    const mine = screen.getByRole("list", { name: "Team 4 chugs" });
    await waitFor(() => expect(within(mine).getAllByRole("button", { name: "Upload chug" })).toHaveLength(2));
    expect(within(screen.getByRole("list", { name: "Team 7 chugs" })).queryByRole("button", { name: "Upload chug" })).toBeNull();

    fireEvent.click(within(mine).getAllByRole("button", { name: "Upload chug" })[1]);
    expect(ticked()).toEqual(["W02#R4#1"]);
  });
});

describe("countdown ticking", () => {
  it("ticks every minute, then every second under an hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T15:58:30Z"));
    render(<ChugBoard ledger={LEDGER} videos={[]} onVideoError={() => {}} />);
    const text = () => screen.getByRole("list", { name: "Team 7 chugs" }).querySelector(".chug-countdown")?.textContent;
    expect(text()).toBe("due in 1h 1m");

    act(() => vi.advanceTimersByTime(59_000));
    expect(text()).toBe("due in 1h 1m");
    act(() => vi.advanceTimersByTime(1000));
    expect(text()).toBe("due in 1h 0m");
    act(() => vi.advanceTimersByTime(60_000));
    expect(text()).toBe("due in 59m 30s");
    act(() => vi.advanceTimersByTime(1000));
    expect(text()).toBe("due in 59m 29s");
  });
});

describe("Chug Reel", () => {
  const reel = (videos: VideosState) => render(<ChugReel week={2} videos={videos} onVideoError={() => {}} />);
  const three: VideosState = { status: "ok", videos: [clip(1), clip(2), clip(3), clip(4, { week: 0 })] };
  const slide = () => screen.getByRole("group").getAttribute("aria-label");
  const caption = () => screen.getByRole("group").textContent;

  it("auto-advances through this week's and last week's chugs, newest first, muted", () => {
    vi.useFakeTimers();
    reel(three);
    expect([slide(), caption()]).toEqual(["1 of 3", "Team 3 · Week 2"]);
    const video = screen.getByRole("group").querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);

    act(() => vi.advanceTimersByTime(REEL_MS));
    expect([slide(), caption()]).toEqual(["2 of 3", "Team 2 · Week 2"]);
    fireEvent.click(screen.getByRole("button", { name: "Next chug" }));
    expect(slide()).toBe("3 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous chug" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous chug" }));
    expect(slide()).toBe("1 of 3");
  });

  it("pauses on hover and on focus", () => {
    vi.useFakeTimers();
    reel(three);
    const region = screen.getByRole("region", { name: "Chug Reel" });
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(REEL_MS * 2));
    expect(slide()).toBe("1 of 3");
    fireEvent.mouseLeave(region);
    act(() => vi.advanceTimersByTime(REEL_MS));
    expect(slide()).toBe("2 of 3");

    fireEvent.focus(screen.getByRole("button", { name: "Next chug" }));
    act(() => vi.advanceTimersByTime(REEL_MS * 2));
    expect(slide()).toBe("2 of 3");
  });

  it("names every team a shared chug covers", () => {
    reel({ status: "ok", videos: [clip(1, { iceIds: ["W02#R1#0", "W02#R2#0"], rosterIds: [1, 2] })] });
    expect(screen.getByRole("button", { name: "Watch Team 1 & Team 2 · Week 2 chug" })).toBeTruthy();
  });

  it("opens the chug with sound on click", () => {
    reel(three);
    fireEvent.click(screen.getByRole("button", { name: "Watch Team 3 · Week 2 chug" }));
    const dialog = screen.getByRole("dialog", { name: "Team 3 · Week 2" });
    expect(dialog.querySelector("video")!.muted).toBe(false);
  });

  it("is a still, scrollable strip under reduced motion", () => {
    reducedMotion(true);
    vi.useFakeTimers();
    reel(three);
    const strip = screen.getByRole("list", { name: "Recent chugs" });
    expect(within(strip).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Watch Team 3 · Week 2 chug",
      "Watch Team 2 · Week 2 chug",
      "Watch Team 1 · Week 2 chug",
    ]);
    expect([...strip.querySelectorAll("video")].some((v) => v.autoplay)).toBe(false);
    expect(screen.queryByRole("button", { name: "Next chug" })).toBeNull();
  });

  it("stalls politely when nobody has chugged", () => {
    reel({ status: "ok", videos: [clip(4, { week: 0 })] });
    expect(screen.getByText("No chugs yet this week. Somebody's stalling.")).toBeTruthy();
  });
});

describe("tray warning", () => {
  const warn = async (now: string, ledger = LEDGER) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    vi.mocked(getLedger).mockResolvedValue(ledger);
    render(
      <ProfileProvider>
        <DueWarning />
      </ProfileProvider>,
    );
    return screen.findByRole("button", { name: /^You owe/ });
  };

  it("counts my owed ices against the deadline, steady over 24h out", async () => {
    const button = await warn("2026-09-25T22:00:00Z");
    expect(button.getAttribute("aria-label")).toBe("You owe 2 ices · due in 1d 19h");
    expect(button.className).toContain("due-due");
  });

  it("blinks under 24h", async () => {
    expect((await warn("2026-09-26T17:00:00Z")).className).toContain("due-soon");
  });

  it("says LATE once late", async () => {
    const button = await warn("2026-09-27T17:00:00Z");
    expect(button.getAttribute("aria-label")).toBe("You owe 2 ices · LATE");
    expect(button.className).toContain("due-late");
  });

  it("opens the upload on my first owed ice", async () => {
    fireEvent.click(await warn("2026-09-25T22:00:00Z"));
    expect(ticked()).toEqual(["W02#R4#0"]);
  });

  it("is absent when I owe nothing", async () => {
    vi.mocked(getMe).mockResolvedValue(me(9));
    render(
      <ProfileProvider>
        <DueWarning />
      </ProfileProvider>,
    );
    await waitFor(() => expect(getLedger).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("button")).toBeNull();
  });
});
