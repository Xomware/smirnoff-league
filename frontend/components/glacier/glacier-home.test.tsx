import { readFileSync } from "node:fs";
import { join } from "node:path";

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
vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  listWriteups: vi.fn(),
}));

import { MobileShell } from "@/components/mobile/MobileShell";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe, type Me } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { listWriteups } from "@/lib/api/writeups";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";
import { GlacierShell } from "./GlacierShell";

const claimed = (rosterId: number): Me => ({
  sub: "s",
  email: "e",
  isAdmin: false,
  profile: { name: "Me", username: "m", rosterId, createdAt: "", updatedAt: "" },
});

function renderHome(shell = <GlacierShell />) {
  return render(
    <ProfileProvider>
      <AlertsProvider>
        <NotificationsProvider>{shell}</NotificationsProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );
}

const region = (name: string) => within(screen.getByRole("region", { name }));
const goHome = () => fireEvent.click(screen.getByRole("link", { name: "Home" }));

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

// Sleeper says week 3 but its Thursday game hasn't kicked off, so Home shows week 2.
beforeEach(() => {
  reducedMotion(false);
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
  vi.mocked(getLedger).mockResolvedValue(TIMED);
  vi.mocked(listVideos).mockResolvedValue([]);
  vi.mocked(listWriteups).mockResolvedValue([
    { mediaId: "W02#abc", week: 2, title: "Week 2 in review", publishedAt: "2026-09-16T12:00:00+00:00", pages: [] },
    { mediaId: "W01#abc", week: 1, title: "Week 1 in review", publishedAt: "2026-09-09T12:00:00+00:00", pages: [] },
  ]);
  vi.mocked(getMe).mockResolvedValue(claimed(13));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

// Two timed chugs, so the chug facts have a fastest and a slowest.
const TIMED = {
  ...SCENARIO_LEDGER,
  ices: SCENARIO_LEDGER.ices.map((ice, i) =>
    i === 0 ? { ...ice, chugSeconds: 6.4, chugger: { name: "Speedy" } } : i === 1 ? { ...ice, chugSeconds: 14.2, chugger: { name: "Slowpoke" } } : ice,
  ),
};

describe("GlacierHome", () => {
  it("renders the hero, your ices, three rotating quick-hitter cards and the news, with no status strip or chips", async () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Every zero is an ice.");
    expect(screen.getByRole("img", { name: /mascot/i }).getAttribute("src")).toContain("mascot.png");
    expect(await screen.findByText("Week 2 · 2026")).toBeTruthy();

    const mine = await region("Your ices").findByRole("list", { name: "Your owed ices" });
    expect(within(mine).getAllByRole("listitem")).toHaveLength(3);
    expect(region("Your ices").getByRole("button", { name: "Upload your chug" })).toBeTruthy();

    const hitters = region("Quick hitters");
    for (const name of ["Ice report", "League", "Chugs"]) {
      expect(await within(hitters.getByRole("region", { name })).findByRole("group", { name: /, 1 of \d+$/ })).toBeTruthy();
    }
    expect(await region("News").findByRole("list", { name: "Latest league news" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "At a glance" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Jump to a section" })).toBeNull();

    fireEvent.click(within(region("Your ices").getByRole("button", { name: /^\d+ owed by Team 13, open Ice Ledger$/ })).getByText(/owed by/));
    expect(window.location.search).toBe("?open=ices");
  });

  it("links every quick hitter to the page behind it", async () => {
    reducedMotion(true);
    renderHome();

    const facts: [string, RegExp, string][] = [
      ["Most ices, week 2", /Team 13.*2 ices/, "?open=week:2"],
      ["Most ices, week 1", /Team \d+/, "?open=week:1"],
      ["Most ices, season", /Team 13/, "?open=ice-standings"],
      ["Most likely to ice next", /Team \d+/, "?open=stats"],
      ["Longest ice streak", /Team \d+.*in a row/, "?open=stats"],
      ["Standings leader", /leaderTeam 11-1 · 199\.00 PF/, "?open=standings"],
      ["Last place", /placeTeam 141-1 · 186\.00 PF/, "?open=standings"],
      ["Toilet bowl risk", /riskTeam 9Seed 9/, "?open=brackets"],
      ["High score, week 2", /Team \d+.*\d+\.\d\d/, "?open=week:2"],
      ["Biggest blowout, week 2", /Team \d+.*beat Team \d+ by/, "?open=week:2"],
      ["Fastest chug", /Speedy.*6\.4s/, "?open=chug-rankings"],
      ["Slowest chug", /Slowpoke.*14\.2s/, "?open=chug-rankings"],
      ["Owes the most", /Team 13.*4 owed/, "?open=ices"],
    ];
    for (const [label, text, search] of facts) {
      const more = await region("Quick hitters").findByRole("button", { name: new RegExp(`^${label}: .*, open `) });
      expect(more.textContent).toMatch(text);
      fireEvent.click(more);
      expect(window.location.search).toBe(search);
      goHome();
    }
  });

  it("feeds the latest News Drop, three league news items and the draft recap", async () => {
    renderHome();
    const news = region("News");

    fireEvent.click(await news.findByRole("button", { name: /^News Drop, week 2: Week 2 in review/ }));
    expect(window.location.search).toBe("?open=writeup:2");
    goHome();

    const items = within(await region("News").findByRole("list", { name: "Latest league news" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Team 2 picks up D. Waller");
    expect(items.some((li) => li.textContent!.includes("News drop:"))).toBe(false);

    fireEvent.click(region("News").getByRole("button", { name: "View more: News" }));
    expect(window.location.search).toBe("?open=news");
    goHome();
    fireEvent.click(await region("News").findByRole("button", { name: /Draft recap/ }));
    expect(window.location.search).toBe("?open=recap");
  });

  it("shows the latest final week's top three awards in the news, and opens the rest", async () => {
    renderHome();

    const awards = await region("News").findByRole("region", { name: "Week 2 awards" });
    const rows = within(awards)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(rows).toEqual(["Top ScoreTeam 1182.68 pts", "Biggest BlowoutTeam 167.70 pts", "Closest EscapeTeam 211.30 pts"]);

    fireEvent.click(within(awards).getByRole("button", { name: "Biggest Blowout: Team 1, open Week 2 awards" }));
    expect(window.location.search).toBe("?open=awards:2");
    expect(await screen.findByRole("list", { name: "Week 2 awards" })).toBeTruthy();
  });

  it("snapshots the standings as the top 3, your team and the bottom 2", async () => {
    vi.mocked(getMe).mockResolvedValue(claimed(7));
    renderHome();

    const list = await region("Standings").findByRole("list", { name: "Standings snapshot" });
    await within(list).findByText("Team 7");
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      expect.stringMatching(/^1Team 1/),
      expect.stringMatching(/^2Team 2/),
      expect.stringMatching(/^3Team 3/),
      expect.stringMatching(/^7Team 7/),
      expect.stringMatching(/^13Team 13/),
      expect.stringMatching(/^14Team 14/),
    ]);
    fireEvent.click(region("Standings").getByRole("button", { name: "See all: Standings" }));
    expect(window.location.search).toBe("?open=standings");
  });

  it("opens your game first from the games list, all games from See all, and the ledger from the hero", async () => {
    renderHome();
    const games = await screen.findByRole("list", { name: "Week 2 games" });
    expect(within(games).getAllByRole("button")).toHaveLength(3);
    const first = golden.weeks[1].matchups.find((m) => m.roster_id === 13)!.matchup_id;

    fireEvent.click(within(games).getAllByRole("button")[0]);
    expect(window.location.search).toBe(`?open=game:2-${first}`);

    goHome();
    fireEvent.click(within(await screen.findByRole("region", { name: "Week 2 games" })).getByRole("button", { name: /^See all/ }));
    expect(window.location.search).toBe("?open=scores");

    goHome();
    fireEvent.click(screen.getByRole("button", { name: "See the ledger" }));
    expect(window.location.search).toBe("?open=ices");
  });

  it("asks a manager with no team to claim one", async () => {
    vi.mocked(getMe).mockResolvedValue({ ...claimed(13), profile: null });
    renderHome();

    expect(await region("Your ices").findByText("Claim your team to see what you owe.")).toBeTruthy();
    expect(region("Your ices").getByRole("button", { name: "Pick your team" })).toBeTruthy();
    expect(region("Your ices").queryByRole("button", { name: "Upload your chug" })).toBeNull();
  });
});

describe("GlacierHome on the phone and the desktop", () => {
  const withCss = () => {
    for (const file of ["glacier-home.css", "glacier-phone.css"]) {
      const style = document.createElement("style");
      style.textContent = readFileSync(join(__dirname, file), "utf8");
      document.head.append(style);
    }
  };
  const sideways = () =>
    [...document.querySelectorAll<HTMLElement>(".gh, .gh *")].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowX));

  it("shows one rotating quick-hitter card on the phone and scrolls nothing sideways", async () => {
    withCss();
    renderHome(<MobileShell theme="glacier" />);

    const hitters = await screen.findByRole("region", { name: "Quick hitters" });
    expect(await within(hitters).findByRole("group", { name: /, 1 of 1\d$/ })).toBeTruthy();
    expect(within(hitters).queryAllByRole("region")).toHaveLength(0);
    await region("News").findByRole("list", { name: "Latest league news" });
    await region("Standings").findByRole("list", { name: "Standings snapshot" });
    expect(document.querySelectorAll(".gh").length).toBe(1);
    expect(sideways()).toEqual([]);
  });

  it("scrolls nothing sideways on the desktop", async () => {
    withCss();
    renderHome();
    await region("News").findByRole("list", { name: "Latest league news" });
    await screen.findByRole("list", { name: "Week 2 games" });
    expect(sideways()).toEqual([]);
  });
});
