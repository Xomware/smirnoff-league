import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  process.env.TZ = "America/New_York";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { startTracking } from "@/lib/activity/tracker";
import type { ActivityRow, AdminUser } from "@/lib/api/admin";
import { DesktopProvider, useDesktop } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { stubSleeper } from "@/lib/test/league-mock";
import { ControlPanelWindow } from "./ControlPanel";

const API = "https://api.test";
const PLAYER = "player-sub";

const user = (patch: Partial<AdminUser>): AdminUser => ({
  sub: "s",
  name: "Someone",
  username: "someone",
  emailAddress: "someone@example.com",
  rosterId: 1,
  createdAt: "2026-09-01T12:00:00+00:00",
  lastSeenAt: null,
  signInCount: 0,
  lastUa: null,
  emailOptIn: false,
  ...patch,
});

let users: AdminUser[];
let stored: Record<string, ActivityRow[]>;
let activityCalls: string[];

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, meta: null }));

// A stand-in for the backend: /activity/track stores what the tracker sends
// under the caller, and the admin routes read it back.
let caller = PLAYER;
beforeEach(() => {
  users = [];
  stored = {};
  activityCalls = [];
  caller = PLAYER;
  sessionStorage.clear();
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input), "https://x.test");
    if (!String(input).startsWith(API)) return sleeper(input, init);
    if (url.pathname === "/users/me") {
      const profile = { name: "Commish", username: "c", rosterId: 2, createdAt: "", updatedAt: "" };
      return envelope({ sub: "admin", email: "e", profile, isAdmin: true });
    }
    if (url.pathname === "/activity/track") {
      const { events } = JSON.parse(String(init?.body)) as { events: Omit<ActivityRow, "ua">[] };
      stored[caller] = [...(stored[caller] ?? []), ...events.map((e) => ({ ...e, ua: "iPhone Safari" }))];
      const seen = users.find((u) => u.sub === caller);
      if (seen) seen.lastSeenAt = new Date().toISOString();
      return envelope({ recorded: events.length });
    }
    if (url.pathname === "/admin/users") return envelope(users);
    if (url.pathname === "/admin/activity") {
      const sub = url.searchParams.get("sub")!;
      activityCalls.push(sub);
      return envelope([...(stored[sub] ?? [])].reverse());
    }
    throw new Error(`unexpected ${url.pathname}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const renderUsers = () =>
  render(
    <ProfileProvider>
      <ControlPanelWindow params={{ panel: "users" }} />
    </ProfileProvider>,
  );

const table = () => screen.findByRole("table", { name: /league members/i });
const names = (t: HTMLElement) => within(t).getAllByRole("rowheader").map((c) => c.textContent);

describe("Users panel", () => {
  it("lists every user with team, last seen, sign-ins, device, alerts and joined", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    users = [
      user({ sub: "a", name: "Alpha", username: "alpha", rosterId: 6, lastSeenAt: tenMinutesAgo, signInCount: 4, lastUa: "Mac Chrome", emailOptIn: true }),
      user({ sub: "b", name: "Bravo", username: "bravo", rosterId: 3 }),
    ];
    renderUsers();
    const t = await table();
    const [alpha] = within(t).getAllByRole("row").slice(1);
    const cells = within(alpha).getAllByRole("cell").map((c) => c.textContent);
    await waitFor(() => expect(within(alpha).getAllByRole("cell")[0].textContent).toBe("Team 6"));
    expect(within(alpha).getByRole("rowheader").textContent).toBe("Alpha@alpha");
    expect(cells.slice(1)).toEqual(["10m ago", "4", "Mac Chrome", "On", "Sep 1, 2026"]);
    const bravo = within(t).getAllByRole("row")[2];
    expect(within(bravo).getAllByRole("cell").map((c) => c.textContent).slice(1, 5)).toEqual(["Never", "0", "Unknown", "Off"]);
  });

  it("sorts on a header click", async () => {
    users = [
      user({ sub: "a", name: "Alpha", signInCount: 1, lastSeenAt: "2026-09-20T12:00:00+00:00" }),
      user({ sub: "b", name: "Bravo", signInCount: 9, lastSeenAt: "2026-09-22T12:00:00+00:00" }),
      user({ sub: "c", name: "Charlie", signInCount: 5 }),
    ];
    renderUsers();
    const t = await table();
    expect(names(t).map((n) => n?.split("@")[0])).toEqual(["Bravo", "Alpha", "Charlie"]);

    const signIns = within(t).getByRole("columnheader", { name: /sign-ins/i });
    fireEvent.click(within(signIns).getByRole("button"));
    expect(signIns.getAttribute("aria-sort")).toBe("descending");
    expect(names(t).map((n) => n?.split("@")[0])).toEqual(["Bravo", "Charlie", "Alpha"]);

    fireEvent.click(within(signIns).getByRole("button"));
    expect(signIns.getAttribute("aria-sort")).toBe("ascending");
    expect(names(t).map((n) => n?.split("@")[0])).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  it("scenario: a user signs in, opens Ice Stats then a team, and the admin sees it in order", async () => {
    users = [user({ sub: PLAYER, name: "Player One", username: "p1", rosterId: 6 })];

    // The player's session: signed in, then two windows opened on the desktop.
    const stop = startTracking();
    let open: ReturnType<typeof useDesktop>["open"] = () => {};
    function Opener() {
      open = useDesktop().open;
      return null;
    }
    const player = render(
      <DesktopProvider>
        <Opener />
      </DesktopProvider>,
    );
    act(() => open("stats"));
    act(() => open("team", { rosterId: 6 }));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(stored[PLAYER]).toHaveLength(3));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    stop();
    player.unmount();

    renderUsers();
    const t = await table();
    const row = within(t).getByRole("row", { name: /player one/i });
    expect(within(row).getAllByRole("cell")[1].textContent).toBe("just now");

    fireEvent.click(within(row).getByRole("button", { name: /player one/i }));
    const timeline = await screen.findByRole("list", { name: /activity for player one/i });
    await waitFor(() =>
      expect(within(timeline).getAllByRole("listitem").map((li) => li.querySelector(".cp-event")?.textContent)).toEqual([
        "Opened Team: Team 6",
        "Opened Ice Stats",
        "Signed in",
      ]),
    );
    expect(activityCalls).toEqual([PLAYER]);

    fireEvent.click(screen.getByRole("button", { name: /all users/i }));
    expect(await table()).toBeTruthy();
  });
});
