import { fireEvent, render, screen, within } from "@testing-library/react";
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

import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe, type Me } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";
import { GlacierShell } from "./GlacierShell";

const claimed: Me = { sub: "s", email: "e", isAdmin: false, profile: { name: "Me", username: "m", rosterId: 13, createdAt: "", updatedAt: "" } };

function renderHome() {
  return render(
    <ProfileProvider>
      <AlertsProvider>
        <NotificationsProvider>
          <GlacierShell />
        </NotificationsProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );
}

const region = (name: string) => within(screen.getByRole("region", { name }));

// Sleeper says week 3 but its Thursday game hasn't kicked off, so Home shows week 2.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T16:00Z"));
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
  vi.mocked(getMe).mockResolvedValue(claimed);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("GlacierHome", () => {
  it("renders the hero, your ices, the chug board, the week's games and the ice standings", async () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Every zero is an ice.");
    expect(screen.getByRole("img", { name: /mascot/i }).getAttribute("src")).toContain("mascot.png");
    expect(await screen.findByText("Week 2 · 2026")).toBeTruthy();
    expect(await screen.findByText(/Week 2 left 3 ices on the board/)).toBeTruthy();

    const mine = await region("Your ices").findByRole("list", { name: "Your owed ices" });
    expect(within(mine).getAllByRole("listitem")).toHaveLength(4);
    expect(region("Your ices").getByText("LATE")).toBeTruthy();
    expect(region("Your ices").getByRole("button", { name: "Upload your chug" })).toBeTruthy();

    expect(await region("Chug Board").findByRole("list", { name: "Team 13 chugs" })).toBeTruthy();

    const games = await region("Week 2 games").findByRole("list", { name: "Week 2 games" });
    expect(within(games).getAllByRole("button")).toHaveLength(golden.weeks[1].matchups.length / 2);

    const standings = await region("Ice standings").findByRole("list", { name: "Top of the ice standings" });
    expect(within(standings).getAllByRole("listitem")).toHaveLength(5);
    expect(within(standings).getAllByRole("listitem")[0].textContent).toContain("Team 13");
  });

  it("opens a game in the shell from its card, and the ledger from the hero", async () => {
    renderHome();
    const games = await screen.findByRole("list", { name: "Week 2 games" });
    const first = Math.min(...golden.weeks[1].matchups.map((m) => m.matchup_id ?? Infinity));

    fireEvent.click(within(games).getAllByRole("button")[0]);
    expect(window.location.search).toBe(`?open=game:2-${first}`);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe("Every zero is an ice.");

    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "See the ledger" }));
    expect(window.location.search).toBe("?open=ices");
  });

  it("asks a manager with no team to claim one", async () => {
    vi.mocked(getMe).mockResolvedValue({ ...claimed, profile: null });
    renderHome();

    expect(await region("Your ices").findByText("Claim your team to see what you owe.")).toBeTruthy();
    expect(region("Your ices").getByRole("button", { name: "Pick your team" })).toBeTruthy();
    expect(region("Your ices").queryByRole("button", { name: "Upload your chug" })).toBeNull();
  });
});
