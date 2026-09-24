import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

import { ProfileGate } from "@/components/onboarding/profile-gate";
import { DrillContext } from "@/components/views/drill-link";
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { getMe, type Me } from "@/lib/api/users";
import { listVideos, type Video } from "@/lib/api/videos";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { clearSharedResources } from "@/lib/shared-resource";
import { stubSleeper } from "@/lib/test/league-mock";
import { ChugReelPopup, QUIET_MS, REEL_POPUP_MS } from "./ChugReelPopup";

const clip = (n: number, week = 2): Video => ({
  mediaId: `v${n}`,
  iceIds: [`W0${week}#R${n}#0`],
  week,
  rosterIds: [n],
  createdAt: `2026-09-2${n}T12:00:00+00:00`,
  bytes: 1,
  url: `https://media.test/${n}.mp4`,
});

const LEDGER: Ledger = {
  ices: [{ iceId: "W02#R3#0", week: 2, rosterId: 3, reason: "lowest", status: "completed", chugSeconds: 4.2, videoId: "v3" }],
  weeks: [],
  summary: [],
};

const ME: Me = {
  sub: "sub-1",
  email: "e",
  profile: { name: "N", username: "u", rosterId: 4, createdAt: "", updatedAt: "" },
  isAdmin: false,
};

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const drill = vi.fn();

// Fake timers throughout: the pop-up waits QUIET_MS for the page to settle.
const settle = () => act(() => vi.advanceTimersByTimeAsync(QUIET_MS));

const mount = async (videos: Video[]) => {
  vi.mocked(listVideos).mockResolvedValue(videos);
  const view = render(
    <ProfileProvider>
      <DrillContext.Provider value={drill}>
        <ChugReelPopup />
      </DrillContext.Provider>
    </ProfileProvider>,
  );
  await settle();
  return view;
};

const reel = () => screen.queryByRole("dialog", { name: /chugs$/ });

// A new session: the shared videos list is fetched again.
const remount = async (view: ReturnType<typeof render>, videos: Video[]) => {
  view.unmount();
  clearSharedResources();
  return mount(videos);
};

beforeEach(() => {
  vi.useFakeTimers();
  stubSleeper();
  localStorage.clear();
  vi.mocked(getMe).mockResolvedValue(ME);
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
});
afterEach(() => {
  // The tests' own stand-in modals and openers sit outside anything React renders.
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.clearAllMocks();
  reducedMotion(false);
});

describe("ChugReelPopup", () => {
  it("shows the latest week's clips once, newest first", async () => {
    await mount([clip(1, 1), clip(2), clip(3)]);
    const dialog = reel();
    expect(screen.getByRole("dialog", { name: "Week 2 chugs" })).toBe(dialog);
    expect(within(dialog!).getByText("2 chugs")).toBeTruthy();
    const cards = within(dialog!).getAllByRole("button", { name: /^Watch/ });
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("Team 3"),
      expect.stringContaining("Team 2"),
    ]);
    expect(within(cards[0]).getByText("Lowest score")).toBeTruthy();
    expect(within(cards[0]).getByText("4.2s")).toBeTruthy();
  });

  it("does not show again after it is closed", async () => {
    const view = await mount([clip(2), clip(3)]);
    fireEvent.click(screen.getByRole("button", { name: "Continue to site" }));
    expect(reel()).toBeNull();

    await remount(view, [clip(2), clip(3)]);
    expect(reel()).toBeNull();
  });

  it("shows again with the new clip first when one arrives for the same week", async () => {
    const view = await mount([clip(2), clip(3)]);
    fireEvent.click(screen.getByRole("button", { name: "Continue to site" }));

    await remount(view, [clip(2), clip(3), clip(1)]);
    const dialog = reel()!;
    expect(within(dialog).getByText("3 chugs · 1 new")).toBeTruthy();
    const first = within(dialog).getAllByRole("button", { name: /^Watch/ })[0];
    expect(first.getAttribute("aria-label")).toContain("Team 1");
    expect(within(first).getByText("New")).toBeTruthy();
  });

  it("does not show with no videos", async () => {
    await mount([]);
    expect(reel()).toBeNull();
  });

  it("does not show over the onboarding wizard", async () => {
    vi.mocked(getMe).mockResolvedValue({ ...ME, profile: null });
    vi.mocked(listVideos).mockResolvedValue([clip(2)]);
    render(
      <ProfileProvider>
        <ProfileGate>
          <ChugReelPopup />
        </ProfileGate>
      </ProfileProvider>,
    );
    await settle();
    await settle();
    expect(screen.getByText("Smirnoff League Setup")).toBeTruthy();
    expect(reel()).toBeNull();
  });

  it("waits for another modal to close, ignoring an inert one", async () => {
    const drawer = document.createElement("div");
    drawer.setAttribute("inert", "");
    drawer.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    document.body.append(drawer);
    const other = document.createElement("div");
    other.setAttribute("aria-modal", "true");
    document.body.append(other);
    await mount([clip(2)]);
    await settle();
    expect(reel()).toBeNull();

    other.remove();
    await settle();
    expect(reel()).toBeTruthy();
  });

  it("auto-advances and pauses on hover", async () => {
    await mount([clip(1), clip(2), clip(3)]);
    expect(screen.getByText("1 of 3")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(REEL_POPUP_MS));
    expect(screen.getByText("2 of 3")).toBeTruthy();

    fireEvent.mouseEnter(screen.getByRole("region", { name: "Chugs" }));
    await act(() => vi.advanceTimersByTimeAsync(REEL_POPUP_MS * 3));
    expect(screen.getByText("2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next chug" }));
    expect(screen.getByText("3 of 3")).toBeTruthy();
  });

  it("does not autoplay with reduced motion", async () => {
    reducedMotion(true);
    await mount([clip(1), clip(2), clip(3)]);
    await act(() => vi.advanceTimersByTimeAsync(REEL_POPUP_MS * 3));
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("opens a clicked clip in the player over the reel", async () => {
    await mount([clip(2), clip(3)]);
    fireEvent.click(screen.getAllByRole("button", { name: /^Watch/ })[1]);
    const player = screen.getByRole("dialog", { name: "Team 2 · Week 2" });
    expect(within(player).getByLabelText("Team 2 · Week 2 chug").getAttribute("src")).toBe("https://media.test/2.mp4#t=0.1");

    fireEvent.keyDown(player, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Team 2 · Week 2" })).toBeNull();
    expect(reel()).toBeTruthy();
  });

  it.each([
    ["Escape", () => fireEvent.keyDown(reel()!, { key: "Escape" })],
    ["X", () => fireEvent.click(within(reel()!).getByRole("button", { name: "Close" }))],
    ["Continue", () => fireEvent.click(screen.getByRole("button", { name: "Continue to site" }))],
  ])("closes on %s and restores focus", async (_, close) => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    await mount([clip(2)]);
    expect(document.activeElement).toBe(within(reel()!).getByRole("button", { name: "Close" }));
    close();
    expect(reel()).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("opens the Chug videos page from View all", async () => {
    await mount([clip(2)]);
    fireEvent.click(screen.getByRole("button", { name: "View all chug videos" }));
    expect(drill).toHaveBeenCalledWith({ kind: "videos" });
    expect(reel()).toBeNull();
  });
});
