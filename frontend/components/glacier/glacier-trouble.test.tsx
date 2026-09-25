import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  listWriteups: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));
vi.mock("@/lib/sound/sound", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound/sound")>()),
  play: vi.fn(),
}));

import { AppShell } from "@/components/AppShell";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { getMe, type Me, updateMe } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { listWriteups } from "@/lib/api/writeups";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";
import { THEME_KEY, ThemeProvider } from "@/lib/theme/theme";
import { PHONE } from "@/lib/use-media-query";

let stored: string | null;
let rosterId: number;
const me = (): Me => ({
  sub: "s",
  email: "e",
  isAdmin: false,
  profile: { name: "N", username: "u", rosterId, theme: "glacier", notificationsSeenAt: stored, createdAt: "", updatedAt: "" },
});

function viewport(phone: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: phone && query === PHONE,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

const renderApp = () =>
  render(
    <ProfileProvider>
      <AlertsProvider>
        <ThemeProvider>
          <DesktopProvider>
            <AppShell />
          </DesktopProvider>
        </ThemeProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );

beforeEach(() => {
  window.localStorage.setItem(THEME_KEY, "glacier");
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  stored = "2026-09-30T12:00:00+00:00";
  rosterId = 4;
  stubSleeper();
  viewport(false);
  vi.mocked(getMe).mockImplementation(async () => me());
  vi.mocked(updateMe).mockImplementation(async (input) => {
    if ("notificationsSeenAt" in input) stored = input.notificationsSeenAt ?? null;
    return me().profile!;
  });
  vi.mocked(listWriteups).mockResolvedValue([]);
  vi.mocked(listVideos).mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("Glacier trouble highlights", () => {
  // Week 3 is live: Sleeper has scores and one ESPN game is in progress.
  const w3 = golden.weeks[1].matchups;
  const lowest = w3.reduce((a, b) => (b.points < a.points ? b : a)).roster_id;

  beforeEach(() => {
    // Sunday 5 PM ET: the live lowest score only counts from 4 PM ET on the week's Sunday.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T21:00:00Z"));
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("espn.com")) return jsonResponse({ events: [espnEvent({ home: "NYJ", away: "MIA", status: "STATUS_IN_PROGRESS", period: 2 })] });
      if (url.endsWith("/matchups/3")) return new Response(JSON.stringify(w3), { status: 200 });
      return sleeper(input, init);
    });
    vi.mocked(getLedger).mockResolvedValue({
      ...SCENARIO_LEDGER,
      summary: [...SCENARIO_LEDGER.summary, { rosterId: 4, owed: 1, completed: 0, late: 0, lateOwed: 0, overdue: 0 }],
    });
    window.history.replaceState(null, "", "/?open=ice-standings");
  });

  const team = (name: string) =>
    waitFor(() => {
      const el = [...document.querySelectorAll<HTMLElement>(".xp-team")].find((t) => t.querySelector(".xp-team-name")?.textContent === name);
      expect(el).toBeTruthy();
      return el!;
    });

  it("marks owing, late and live-lowest teams in the ice standings", async () => {
    renderApp();
    await waitFor(async () => expect((await team("Team 13")).dataset.trouble).toContain("late"));
    expect((await team("Team 4")).dataset.trouble).toContain("owe");
    await waitFor(async () => expect((await team(`Team ${lowest}`)).dataset.trouble).toContain("lowest"));
    expect((await team("Team 13")).textContent).toContain("Late");
    expect((await team("Team 2")).dataset.trouble).toBeUndefined();
  });

  it("marks the same teams on the phone", async () => {
    viewport(true);
    renderApp();
    await waitFor(async () => expect((await team("Team 13")).dataset.trouble).toContain("late"));
  });
});

describe("Glacier ice warnings", () => {
  // Friday noon ET before the W3 deadline, Sunday 2026-10-04 13:00 EDT.
  const FRIDAY = new Date("2026-10-02T16:00:00Z");
  const OWING: Ledger = {
    ices: [{ iceId: "W03#4#0", week: 3, rosterId: 4, reason: "zero", status: "owed" }],
    weeks: [{ week: 3, finalizedAt: "2026-09-29T08:00:00+00:00", deadlineUtc: "2026-10-04T17:00:00+00:00" }],
    summary: [{ rosterId: 4, owed: 1, completed: 0, late: 0, lateOwed: 0, overdue: 0 }],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY);
  });

  it("warns the owner the ice is due, and a dismissal survives a reload", async () => {
    vi.mocked(getLedger).mockResolvedValue(OWING);
    const { unmount } = renderApp();

    const warning = await screen.findByRole("alert", { name: "Ice due Sunday 1 PM ET" });
    expect(warning.textContent).toContain("You owe 1 ice for Week 3");
    expect(await screen.findByRole("button", { name: "You owe 1 ice, due Sun 1 PM. Upload your chug." })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert", { name: "Ice due Sunday 1 PM ET" })).toBeNull();
    await waitFor(() => expect(stored).toBe("2026-10-02T04:00:00.000Z"));

    unmount();
    renderApp();
    await screen.findByRole("button", { name: /^You owe 1 ice/ });
    expect(screen.queryByRole("alert", { name: "Ice due Sunday 1 PM ET" })).toBeNull();
  });

  it("shows nothing to a manager who owes nothing", async () => {
    vi.mocked(getLedger).mockResolvedValue({ ...OWING, ices: [], summary: [] });
    renderApp();

    await screen.findByText("You're square. Nothing owed.");
    expect(screen.queryByRole("alert", { name: /Ice due/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^You owe/ })).toBeNull();
    expect(document.querySelector(".xp-team[data-trouble]")).toBeNull();
  });
});

describe("Glacier lineup warning", () => {
  it("tells the owner to fix an empty slot before the last kickoff", async () => {
    // Thursday, nothing kicked off: roster 4 starts the NYJ defense (its id is its team) everywhere but an empty TE.
    const w3 = golden.weeks[1].matchups.map((m) => (m.roster_id === 4 ? { ...m, starters: m.starters!.map((_, i) => (i === 5 ? "0" : "NYJ")) } : m));
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("espn.com")) return jsonResponse({ events: [espnEvent({ home: "NYJ", away: "MIA" })] });
      if (url.endsWith("/matchups/3")) return jsonResponse(w3);
      return sleeper(input, init);
    });
    vi.mocked(getLedger).mockResolvedValue({ ...SCENARIO_LEDGER, ices: [], summary: [] });
    renderApp();

    const warning = await screen.findByRole("alert", { name: "FIX YOUR LINEUP" });
    expect(warning.textContent).toContain("TE is empty.");
    expect(warning.textContent).not.toContain("more after this");
  });
});
