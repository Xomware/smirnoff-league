import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/activity/tracker", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/activity/tracker")>();
  return { ...real, track: vi.fn(real.track) };
});
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { AppShell } from "@/components/AppShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { track } from "@/lib/activity/tracker";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";

interface Screen {
  width: number;
  height: number;
  coarse: boolean;
}

const IPHONE_15_PRO: Screen = { width: 393, height: 852, coarse: true };
const LANDSCAPE: Screen = { width: 852, height: 393, coarse: true };
const DESKTOP: Screen = { width: 1440, height: 900, coarse: false };
// SCENARIO_LEDGER's roster 13 owes W2's lowest score and a zero, plus a late ice for each.
const ME = 13;
// All of them are week 2's, so an upload ticks every one.
const MY_OWED = SCENARIO_LEDGER.ices.filter((i) => i.rosterId === ME && i.status === "owed").map((i) => i.iceId).sort();
const ticked = (dialog: HTMLElement) =>
  within(dialog)
    .getAllByRole("checkbox")
    .filter((c) => (c as HTMLInputElement).checked)
    .map((c) => (c as HTMLInputElement).value)
    .sort();

let screenNow = IPHONE_15_PRO;
const listeners = new Set<() => void>();

// A tiny media query engine for the features the app queries, so the tests
// exercise the real PHONE query string rather than an echo of it.
function evaluate(query: string, s: Screen): boolean {
  return query.split(",").some((q) =>
    q
      .trim()
      .split(/\s+and\s+/)
      .every((feature) => {
        const [, name, value] = feature.match(/^\(([\w-]+):\s*([\w.]+?)(?:px)?\)$/) ?? [];
        if (name === "max-width") return s.width <= Number(value);
        if (name === "max-height") return s.height <= Number(value);
        if (name === "pointer") return (s.coarse ? "coarse" : "fine") === value;
        if (name === "prefers-reduced-motion") return false;
        throw new Error(`Unhandled media feature: ${feature}`);
      }),
  );
}

function viewport(s: Screen) {
  screenNow = s;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return evaluate(query, screenNow);
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }) as unknown as MediaQueryList,
  );
}

// stubSleeper's week 3 has no matchups yet; give it W2's lineups so Home has games to show.
function withWeek3() {
  const base = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) =>
    String(input).endsWith("/matchups/3") ? new Response(JSON.stringify(golden.weeks[1].matchups)) : base(input, init),
  );
}

function renderShell() {
  return render(
    <ProfileProvider>
      <DesktopProvider>
        <AppShell />
      </DesktopProvider>
    </ProfileProvider>,
  );
}

const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const tabBar = () => within(screen.getByRole("navigation", { name: "Tabs" }));
const tab = (name: string) => tabBar().getByRole("button", { name });
const back = () => screen.getByRole("button", { name: "Back" });
// Screens under the top one stay mounted but hidden, so query the visible one.
const top = () => within(document.querySelector<HTMLElement>(".m-screen:not([hidden])")!);

beforeEach(() => {
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  viewport(IPHONE_15_PRO);
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Thirteen", username: "t", rosterId: ME, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  listeners.clear();
  window.history.replaceState(null, "", "/");
});

describe("shell choice", () => {
  it.each([
    ["an iPhone 15 Pro", true, IPHONE_15_PRO],
    ["an iPhone SE", true, { width: 375, height: 667, coarse: true }],
    ["a landscape phone", true, LANDSCAPE],
    ["a narrow desktop window", true, { width: 600, height: 900, coarse: false }],
    ["a short desktop window with a mouse", false, { width: 1280, height: 420, coarse: false }],
    ["a portrait tablet", false, { width: 768, height: 1024, coarse: true }],
    ["a desktop", false, DESKTOP],
  ])("%s: phone app %s", (_, phone, s) => {
    viewport(s);
    renderShell();
    expect(screen.queryByRole("navigation", { name: "Tabs" }) !== null).toBe(phone);
    expect(document.querySelector(".xp-desktop") !== null).toBe(!phone);
    expect(document.body.classList.contains("xp-cursor")).toBe(!phone);
  });

  it("shows the ice cursor on the desktop only while the mouse is down", () => {
    viewport(DESKTOP);
    const { unmount } = renderShell();
    const body = document.body.classList;

    fireEvent.pointerDown(document.querySelector(".xp-desktop")!);
    expect(body.contains("xp-cursor-pressed")).toBe(true);
    fireEvent.pointerUp(document.querySelector(".xp-desktop")!);
    expect(body.contains("xp-cursor-pressed")).toBe(false);

    unmount();
    expect(body.contains("xp-cursor")).toBe(false);
  });

  it("gives the phone shell no custom cursor, even when pressed", () => {
    renderShell();
    fireEvent.pointerDown(document.querySelector(".m-screen")!);
    expect(document.body.className).not.toMatch(/xp-cursor/);
  });

  it("keeps the screen when the phone rotates", async () => {
    renderShell();
    fireEvent.click(tab("Menu"));
    fireEvent.click(top().getByRole("button", { name: /Standings/ }));
    await waitFor(() => expect(title()).toBe("League Standings"));

    act(() => {
      screenNow = LANDSCAPE;
      listeners.forEach((fn) => fn());
    });

    expect(title()).toBe("League Standings");
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Menu"));
  });
});

describe("Glacier", () => {
  const renderGlacier = () =>
    render(
      <ProfileProvider>
        <NotificationsProvider>
          <MobileShell theme="glacier" />
        </NotificationsProvider>
      </ProfileProvider>,
    );

  it("themes its root, with the pill tab bar and the snow", () => {
    const { container } = renderGlacier();
    const root = container.firstElementChild!;
    expect(root.getAttribute("data-theme")).toBe("glacier");
    expect(root.querySelector(".m-tabs-pill")).toBe(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabBar().getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "Menu"]);
    expect(root.querySelector(".glacier-effects")).not.toBeNull();
  });

  it("opens with Glacier's home and still switches tabs", async () => {
    renderGlacier();
    expect(await top().findByRole("heading", { name: "Every zero is an ice." })).toBeTruthy();
    expect(top().getByRole("region", { name: "Your ices" })).toBeTruthy();

    fireEvent.click(tab("Games"));
    expect(title()).toBe("Games");
    expect(tab("Games").getAttribute("aria-current")).toBe("page");
    expect(await top().findByRole("button", { name: "Previous week" })).toBeTruthy();

    fireEvent.click(tab("Home"));
    expect(title()).toBe("Smirnoff League");
    expect(top().getByRole("heading", { name: "Every zero is an ice." })).toBeTruthy();
  });

  it("leaves the default XP phone untouched", () => {
    const { container } = renderShell();
    expect(container.querySelector("[data-theme]")).toBeNull();
    expect(container.querySelector(".m-tabs-pill, .glacier-effects")).toBeNull();
    expect(container.querySelector(".m-hero")).not.toBeNull();
  });
});

describe("tabs", () => {
  it("has exactly four: Home, Games, Ices and Menu", () => {
    renderShell();
    expect(tabBar().getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "Menu"]);
    expect(tab("Home").getAttribute("aria-current")).toBe("page");
    expect(title()).toBe("Smirnoff League");
  });

  it.each(["Home", "Games", "Menu"])("%s has no tab strip of its own", async (name) => {
    withWeek3();
    renderShell();
    fireEvent.click(tab(name));
    await waitFor(() => expect(top().queryByRole("status")).toBeNull());
    expect(top().queryByRole("tablist")).toBeNull();
  });

  it("tracks each tab and each pushed screen as an open", async () => {
    vi.mocked(track).mockClear();
    renderShell();
    fireEvent.click(tab("Menu"));
    fireEvent.click(top().getByRole("button", { name: /Brackets/ }));
    await waitFor(() => expect(title()).toBe("Brackets"));
    expect(vi.mocked(track).mock.calls).toEqual([
      ["open", "tab:menu"],
      ["open", "brackets"],
    ]);
  });

  it("reaches the draft recap, my profile and settings from Menu", async () => {
    renderShell();
    fireEvent.click(tab("Menu"));
    fireEvent.click(top().getByRole("button", { name: "Draft recap" }));
    await waitFor(() => expect(title()).toBe("Now Playing - Draft Recap"));
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Menu"));

    fireEvent.click(top().getByRole("button", { name: "My Profile" }));
    await waitFor(() => expect(title()).toBe("My Profile"));
    expect(await top().findByRole("textbox", { name: "Full name" })).toBeTruthy();
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Menu"));

    fireEvent.click(top().getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(title()).toBe("Settings"));
    expect(await top().findByRole("checkbox", { name: /Email me alerts/ })).toBeTruthy();
    expect(window.location.search).toBe("?open=menu,settings");
  });

  it("lists the Control Panel only for an admin", async () => {
    renderShell();
    fireEvent.click(tab("Menu"));
    await top().findByRole("heading", { name: "Thirteen" });
    expect(top().queryByRole("button", { name: /Control Panel/ })).toBeNull();
  });
});

describe("Home", () => {
  it("shows what I owe and uploads for the oldest owed week", async () => {
    renderShell();
    const mine = within(await screen.findByRole("region", { name: "Your ices" }));
    expect((await mine.findByRole("list", { name: "Your owed ices" })).children).toHaveLength(4);

    fireEvent.click(mine.getByRole("button", { name: "Upload your chug" }));

    expect(ticked(screen.getByRole("dialog", { name: "Upload chug" }))).toEqual(MY_OWED);
  });

  it("opens the Games tab from All games", async () => {
    renderShell();
    fireEvent.click(await top().findByRole("button", { name: "All games" }));
    expect(tab("Games").getAttribute("aria-current")).toBe("page");
    expect(window.location.search).toBe("?open=games");
  });
});

describe("Games", () => {
  it("steps weeks and pushes a game with both lineups, Back and the browser's back both returning", async () => {
    renderShell();
    fireEvent.click(tab("Games"));
    expect(await top().findByText("No matchups for week 3 yet.")).toBeTruthy();

    fireEvent.click(top().getByRole("button", { name: "Previous week" }));
    const games = await top().findByRole("list", { name: "Week 2 matchups" });
    expect(within(games).getAllByRole("button")).toHaveLength(7);

    fireEvent.click(within(games).getByRole("button", { name: /Team 13/ }));
    await waitFor(() => expect(title()).toBe("Week 2"));
    expect(window.location.search).toMatch(/^\?open=games,game:2-\d+$/);
    expect(top().getAllByRole("region", { name: /lineup$/ })).toHaveLength(2);
    expect(top().getByRole("region", { name: "Team 13 lineup" })).toBeTruthy();
    expect(top().getByRole("list", { name: "Team 13 ices" }).textContent).toContain("Lowest score");
    expect(top().getByRole("list", { name: "Team 13 bench" })).toBeTruthy();

    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Games"));
    expect(top().getByRole("list", { name: "Week 2 matchups" })).toBeTruthy();

    fireEvent.click(within(top().getByRole("list", { name: "Week 2 matchups" })).getAllByRole("button")[0]);
    await waitFor(() => expect(title()).toBe("Week 2"));
    act(() => window.history.back());
    await waitFor(() => expect(title()).toBe("Games"));
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("opens a deep-linked game over the Games tab", async () => {
    window.history.replaceState(null, "", "/?open=games,game:1-1");
    renderShell();
    expect(tab("Games").getAttribute("aria-current")).toBe("page");
    expect(title()).toBe("Week 1");
    expect(await top().findAllByRole("region", { name: /lineup$/ })).toHaveLength(2);
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Games"));
  });
});

describe("scenario at 393px", () => {
  it("Home, a matchup, Back, the Ices tab, then Upload for my owed ice", async () => {
    withWeek3();
    renderShell();
    const row = await screen.findByRole("list", { name: "This week's matchups" });
    fireEvent.click(within(row).getAllByRole("button")[0]);
    await waitFor(() => expect(title()).toBe("Week 3"));
    expect(tab("Home").getAttribute("aria-current")).toBe("page");

    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Smirnoff League"));

    fireEvent.click(tab("Ices"));
    expect(title()).toBe("Ices");
    const owes = within(await top().findByRole("list", { name: "Who still owes" }));
    fireEvent.click(owes.getByRole("button", { name: "Upload chug" }));

    expect(ticked(screen.getByRole("dialog", { name: "Upload chug" }))).toEqual(MY_OWED);
  });
});

describe("Ices", () => {
  it("ranks the season or this week with a segmented control, not tabs", async () => {
    renderShell();
    fireEvent.click(tab("Ices"));
    const ranks = within(await top().findByRole("list", { name: "Ice standings" }));
    expect(ranks.getAllByRole("listitem").map((r) => parseInt(r.textContent!))).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));

    const views = within(top().getByRole("group", { name: "Ice standings for" }));
    expect(views.getByRole("button", { name: "Season" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(views.getByRole("button", { name: "Week 3" }));
    expect(views.getByRole("button", { name: "Week 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(top().getByText(/Week 3 is live/)).toBeTruthy();
    expect(top().queryByRole("tablist")).toBeNull();
  });

  it("lists who still owes, most first, with only my own row offering an upload", async () => {
    renderShell();
    fireEvent.click(tab("Ices"));
    const rows = within(await top().findByRole("list", { name: "Who still owes" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent?.match(/Team \d+/)?.[0])).toEqual(["Team 13", "Team 12"]);
    expect(within(rows[0]).getByRole("button", { name: "Upload chug" })).toBeTruthy();
    expect(within(rows[1]).queryByRole("button", { name: "Upload chug" })).toBeNull();
  });
});

// Every screen may carry one chip row to jump between its sections, and no tab strip.
function expectStacked(label: string, sections: string[]) {
  expect(top().queryByRole("tablist")).toBeNull();
  expect(document.querySelectorAll(".m-screen:not([hidden]) nav")).toHaveLength(1);
  const chips = within(top().getByRole("navigation", { name: label }));
  expect(chips.getAllByRole("button").map((b) => b.textContent)).toEqual(sections);
  expect(top().getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(sections));
}

describe("Ice Rankings", () => {
  it("has a Menu row and a section in the Ices tab", async () => {
    renderShell();
    fireEvent.click(tab("Ices"));
    expect(await top().findByRole("heading", { name: "Ice Rankings" })).toBeTruthy();

    fireEvent.click(tab("Menu"));
    fireEvent.click(top().getByRole("button", { name: "Rankings" }));
    await waitFor(() => expect(title()).toBe("Ice Rankings"));
    expect(window.location.search).toBe("?open=menu,chug-rankings");
  });
});

describe("screens that were tabbed on the desktop", () => {
  it("stacks Ice Stats' sections under one chip row", async () => {
    renderShell();
    fireEvent.click(tab("Menu"));
    fireEvent.click(top().getByRole("button", { name: "Stats" }));
    await top().findByRole("navigation", { name: "Ice Stats sections" });
    expectStacked("Ice Stats sections", ["Overview", "Race", "Lineups", "Positions", "Hall of Shame"]);
  });

  it("stacks a team profile, and drills from its lineup to a player and back", async () => {
    window.history.replaceState(null, "", "/?open=team:6");
    renderShell();
    expect(tab("Menu").getAttribute("aria-current")).toBe("page");
    await top().findByRole("navigation", { name: "Team 6 sections" });
    expect(title()).toBe("Team 6");
    expectStacked("Team 6 sections", ["Results", "Ices", "Moves", "Head-to-head", "Lineup"]);
    expect(within(top().getByRole("list", { name: "Weekly results" })).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(within(top().getByRole("list", { name: "Weekly results" })).getByRole("button", { name: "91.46 - 134.46" }));
    await waitFor(() => expect(window.location.search).toBe("?open=menu,team:6,game:1-7"));
    expect(title()).toBe("Week 1");
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Team 6"));

    fireEvent.click(within(top().getByRole("list", { name: /^Starters/ })).getAllByRole("button")[0]);
    await waitFor(() => expect(window.location.search).toMatch(/^\?open=menu,team:6,player:\w+$/));
    fireEvent.click(back());
    await waitFor(() => expect(title()).toBe("Team 6"));
  });
});
