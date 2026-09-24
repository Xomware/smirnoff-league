import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));
vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  listWriteups: vi.fn(),
}));

import { GlacierShell } from "@/components/glacier/GlacierShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe, type Me } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { listWriteups } from "@/lib/api/writeups";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import type { TickerItem } from "@/lib/ticker/items";
import { setTickerHidden } from "@/lib/ticker/prefs";
import { TickerBar } from "./Ticker";

const ITEMS: TickerItem[] = [
  { id: "a", tag: "W2 FINAL", text: "Team 1 101.2 – 88.4 Team 2", to: { kind: "game", week: 2, matchup: 1 } },
  { id: "b", tag: "LATE", text: "Team 13 owes an ice · W2 lowest score 82.10 · +1 late", to: { kind: "team", rosterId: 13 }, tone: "late" },
  { id: "c", tag: "NEWS DROP", text: "The Week 2 Drop", to: { kind: "writeup", week: 2 } },
];

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

function renderBar(items = ITEMS, open = vi.fn<(to: DrillTarget) => void>()) {
  const view = render(
    <DrillContext value={open}>
      <TickerBar items={items} />
    </DrillContext>,
  );
  return { open, view };
}

const bar = () => within(screen.getByRole("region", { name: "League ticker" }));

beforeEach(() => {
  reducedMotion(false);
  setTickerHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("TickerBar", () => {
  it("opens an item's page when it is clicked, and marks its tone", () => {
    const { open } = renderBar();
    fireEvent.click(bar().getByRole("button", { name: "LATE Team 13 owes an ice · W2 lowest score 82.10 · +1 late" }));
    expect(open).toHaveBeenCalledWith({ kind: "team", rosterId: 13 });
    expect(bar().getByRole("button", { name: /Team 13 owes/ }).closest("li")?.getAttribute("data-tone")).toBe("late");
    expect(bar().getByRole("button", { name: /The Week 2 Drop/ }).closest("li")?.hasAttribute("data-tone")).toBe(false);
  });

  it("loops a hidden, inert copy of the list so screen readers hear each item once", () => {
    renderBar();
    const lists = screen.getByRole("region", { name: "League ticker" }).querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1].getAttribute("aria-hidden")).toBe("true");
    expect(lists[1].hasAttribute("inert")).toBe(true);
    expect(bar().getAllByRole("button", { name: /The Week 2 Drop/ })).toHaveLength(1);
  });

  it("pauses and resumes from its button", () => {
    renderBar();
    const region = screen.getByRole("region", { name: "League ticker" });
    fireEvent.click(bar().getByRole("button", { name: "Pause ticker" }));
    expect(region.hasAttribute("data-paused")).toBe(true);
    fireEvent.click(bar().getByRole("button", { name: "Play ticker" }));
    expect(region.hasAttribute("data-paused")).toBe(false);
  });

  it("holds while touched", () => {
    renderBar();
    const region = screen.getByRole("region", { name: "League ticker" });
    fireEvent.touchStart(region);
    expect(region.hasAttribute("data-paused")).toBe(true);
    fireEvent.touchEnd(region);
    expect(region.hasAttribute("data-paused")).toBe(false);
  });

  it("swaps in new items at the end of a loop, not mid-scroll", () => {
    const { open, view } = renderBar();
    const fresh = [...ITEMS, { id: "d", tag: "CHUG", text: "Commish chugged in 7.4s", to: { kind: "chug-rankings" } } as TickerItem];
    view.rerender(
      <DrillContext value={open}>
        <TickerBar items={fresh} />
      </DrillContext>,
    );
    expect(bar().queryByRole("button", { name: /Commish/ })).toBeNull();
    // jsdom has no AnimationEvent, so React listens for the webkit-prefixed name.
    fireEvent(screen.getByRole("region", { name: "League ticker" }).querySelector(".tk-track")!, new Event("webkitAnimationIteration", { bubbles: true }));
    expect(bar().getByRole("button", { name: /Commish/ })).toBeTruthy();
  });

  it("steps through one item at a time under reduced motion, with no auto-advance", () => {
    reducedMotion(true);
    vi.useFakeTimers();
    const { open } = renderBar();
    expect(screen.getByRole("region", { name: "League ticker" }).querySelectorAll("ul")).toHaveLength(0);
    expect(bar().queryByRole("button", { name: /Pause/ })).toBeNull();
    expect(bar().getByText("1 of 3")).toBeTruthy();
    expect(bar().getByRole("button", { name: /Team 1 101.2/ })).toBeTruthy();

    act(() => vi.advanceTimersByTime(60_000));
    expect(bar().getByText("1 of 3")).toBeTruthy();

    fireEvent.click(bar().getByRole("button", { name: "Next item" }));
    fireEvent.click(bar().getByRole("button", { name: /Team 13 owes/ }));
    expect(open).toHaveBeenCalledWith({ kind: "team", rosterId: 13 });
    fireEvent.click(bar().getByRole("button", { name: "Previous item" }));
    fireEvent.click(bar().getByRole("button", { name: "Previous item" }));
    expect(bar().getByText("3 of 3")).toBeTruthy();
  });
});

const claimed = (rosterId: number): Me => ({
  sub: "s",
  email: "e",
  isAdmin: false,
  profile: { name: "Me", username: "m", rosterId, createdAt: "", updatedAt: "" },
});

function renderShell(shell = <GlacierShell />) {
  return render(
    <ProfileProvider>
      <AlertsProvider>
        <NotificationsProvider>{shell}</NotificationsProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );
}

describe("the ticker in the shells", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T17:00Z"));
    Element.prototype.scrollIntoView = vi.fn();
    stubSleeper();
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).includes("espn.com")
        ? jsonResponse({ events: [espnEvent({ home: "NYJ", away: "MIA", date: "2026-09-25T00:15Z" })] })
        : sleeper(input, init),
    );
    vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
    vi.mocked(listVideos).mockResolvedValue([]);
    vi.mocked(listWriteups).mockResolvedValue([
      { mediaId: "W02#abc", week: 2, title: "Week 2 in review", publishedAt: "2026-09-16T12:00:00+00:00", pages: [] },
    ]);
    vi.mocked(getMe).mockResolvedValue(claimed(13));
  });

  it("sits in the Glacier page flow under the header, built from the league's data, and opens pages in the shell", async () => {
    renderShell();
    const region = await screen.findByRole("region", { name: "League ticker" });
    expect(region.previousElementSibling?.classList.contains("glacier-header")).toBe(true);
    expect(within(region).getByRole("status").textContent).toBe("Checking the wire...");
    expect(await within(region).findAllByRole("button", { name: /^W2 FINAL Team \d+ [\d.]+ – [\d.]+ Team \d+$/ })).toHaveLength(7);
    expect(within(region).getAllByRole("button", { name: "LATE Team 13 owes an ice · W2 lowest score 82.10 · +1 late" }).length).toBeGreaterThan(0);
    expect(within(region).getAllByRole("button", { name: "LATE Team 13 owes an ice · W2 4983 (WR) -0.10 · +1 late" }).length).toBeGreaterThan(0);
    expect(within(region).getByRole("button", { name: "NEWS DROP Week 2 in review" })).toBeTruthy();
    expect(within(region).getAllByRole("button", { name: "DUE Ices due Sun 1 PM ET · 3d 0h" }).length).toBeGreaterThan(0);

    fireEvent.click(within(region).getByRole("button", { name: /Team 1 leads/ }));
    expect(window.location.search).toBe("?open=standings");
  });

  it("hides when the setting is off, and Settings turns it back on", async () => {
    window.history.replaceState(null, "", "/?open=settings");
    renderShell();
    await screen.findByRole("region", { name: "League ticker" });
    const box = await screen.findByRole("checkbox", { name: "Show the league ticker" });
    fireEvent.click(box);
    expect(screen.queryByRole("region", { name: "League ticker" })).toBeNull();
    fireEvent.click(box);
    expect(screen.getByRole("region", { name: "League ticker" })).toBeTruthy();
  });

  it("sits under the phone title bar in both themes", async () => {
    renderShell(<MobileShell theme="xp" />);
    const region = await screen.findByRole("region", { name: "League ticker" });
    expect(region.previousElementSibling?.classList.contains("m-bar")).toBe(true);
    expect(region.hasAttribute("data-xp")).toBe(true);
  });
});
