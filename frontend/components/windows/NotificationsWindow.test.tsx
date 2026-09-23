import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { AppShell } from "@/components/phone/AppShell";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger, type Ledger } from "@/lib/api/ledger";
import { ApiError, getMe, type Me, updateMe } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { listWriteups } from "@/lib/api/writeups";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { play } from "@/lib/sound/sound";
import { stubSleeper } from "@/lib/test/league-mock";
import { PHONE } from "@/lib/use-media-query";

// Friday noon ET before the W3 deadline, Sunday 2026-10-04 13:00 EDT.
const FRIDAY = new Date("2026-10-02T16:00:00Z");
const ME = 4;

// My W3 ice was finalized Tuesday and already seen Wednesday, so only "due" is new.
const LEDGER: Ledger = {
  ices: [{ iceId: "W03#4#0", week: 3, rosterId: ME, reason: "zero", status: "owed" }],
  weeks: [{ week: 3, finalizedAt: "2026-09-29T08:00:00+00:00", deadlineUtc: "2026-10-04T17:00:00+00:00" }],
  summary: [],
};

// Stands in for smirnoff-users: updateMe writes here and getMe reads it back.
let stored: string | null;
const me = (): Me => ({
  sub: "s",
  email: "e",
  isAdmin: false,
  profile: { name: "N", username: "u", rosterId: ME, notificationsSeenAt: stored, createdAt: "", updatedAt: "" },
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
        <DesktopProvider>
          <AppShell />
        </DesktopProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );

// The open window's taskbar button is also named "Notifications", so find the bell itself.
const bell = (name: string) =>
  waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>(".notif-bell");
    expect(found?.getAttribute("aria-label")).toBe(name);
    return found!;
  });
const list = () => screen.findByRole("list", { name: "Notifications" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRIDAY);
  window.sessionStorage.clear();
  stored = "2026-09-30T12:00:00+00:00";
  stubSleeper();
  viewport(false);
  vi.mocked(getMe).mockImplementation(async () => me());
  vi.mocked(updateMe).mockImplementation(async (input) => {
    if ("notificationsSeenAt" in input) stored = input.notificationsSeenAt;
    return me().profile!;
  });
  vi.mocked(getLedger).mockResolvedValue(LEDGER);
  vi.mocked(listWriteups).mockResolvedValue([]);
  vi.mocked(listVideos).mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(play).mockClear();
  window.history.replaceState(null, "", "/");
});

describe("tray bell", () => {
  it("counts items after the seen mark", async () => {
    renderApp();
    const tray = await bell("Notifications, 1 unread");
    expect(tray.textContent).toBe("1");
  });

  it("counts everything when nothing has been seen", async () => {
    stored = null;
    renderApp();
    await bell("Notifications, 2 unread");
  });

  it("opening the window marks everything seen, optimistically", async () => {
    let save: () => void = () => {};
    vi.mocked(updateMe).mockImplementation(
      (input) =>
        new Promise((resolve) => {
          save = () => {
            if ("notificationsSeenAt" in input) stored = input.notificationsSeenAt;
            resolve(me().profile!);
          };
        }),
    );
    renderApp();
    fireEvent.click(await bell("Notifications, 1 unread"));

    const items = within(await list()).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("New: Ice due Sunday 1 PM ETYou owe 1 ice for Week 3"),
      expect.stringMatching(/^You got icedWeek 3: a starter scored zero/),
    ]);
    expect(updateMe).toHaveBeenCalledWith({ notificationsSeenAt: FRIDAY.toISOString() });
    await bell("Notifications");
    save();
    await waitFor(() => expect(stored).toBe(FRIDAY.toISOString()));
  });

  it("rolls the mark back and says so when saving fails", async () => {
    vi.mocked(updateMe).mockRejectedValue(new ApiError(500, "Internal error"));
    renderApp();
    fireEvent.click(await bell("Notifications, 1 unread"));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not mark these as read (Internal error)");
    await bell("Notifications, 1 unread");
  });
});

describe("balloon", () => {
  it("raises once per session with the notify sound", async () => {
    const first = renderApp();
    const balloon = await screen.findByRole("status", { name: "1 new notification" });
    expect(balloon.textContent).toContain("Ice due Sunday 1 PM ET. You owe 1 ice for Week 3.");
    expect(play).toHaveBeenCalledWith("notify");
    first.unmount();

    renderApp();
    await bell("Notifications, 1 unread");
    expect(screen.queryByRole("status", { name: /new notification/ })).toBeNull();
    expect(vi.mocked(play).mock.calls.filter(([s]) => s === "notify")).toHaveLength(1);
  });

  it("stays quiet with nothing unread", async () => {
    stored = FRIDAY.toISOString();
    renderApp();
    fireEvent.click(await bell("Notifications"));
    await list();
    expect(screen.queryByRole("status", { name: /new notification/ })).toBeNull();
    expect(play).not.toHaveBeenCalledWith("notify");
  });
});

describe("scenario: an owed W3 ice on the Friday before the deadline", () => {
  it("shows the due item, clears the badge on open, and stays cleared after a reload", async () => {
    viewport(true);
    const first = renderApp();
    fireEvent.click(await bell("Notifications, 1 unread"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Notifications");
    const due = within(await list()).getAllByRole("listitem")[0];
    expect(due.textContent).toContain("Ice due Sunday 1 PM ET");
    await bell("Notifications");
    await waitFor(() => expect(stored).toBe(FRIDAY.toISOString()));

    fireEvent.click(within(due).getByRole("button"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ice Ledger");
    first.unmount();

    renderApp();
    fireEvent.click(await bell("Notifications"));
    const again = within(await list()).getAllByRole("listitem")[0];
    expect(again.textContent).toMatch(/^Ice due Sunday 1 PM ET/);
  });
});
