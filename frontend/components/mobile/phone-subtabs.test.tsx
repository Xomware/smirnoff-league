import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { MobileShell } from "@/components/mobile/MobileShell";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SECTIONS } from "@/lib/sections";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";

function renderPhone(theme: "xp" | "glacier" = "glacier") {
  return render(
    <ProfileProvider>
      <NotificationsProvider>
        <MobileShell theme={theme} />
      </NotificationsProvider>
    </ProfileProvider>,
  );
}

function signIn(isAdmin: boolean) {
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin,
    profile: { name: "Thirteen", username: "t", rosterId: 13, createdAt: "", updatedAt: "" },
  });
}

const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const shown = () => [...document.querySelectorAll<HTMLElement>(".m-screen:not([hidden])")];
const top = () => within(shown()[0]);
const subtabs = (section: string) => within(screen.getByRole("navigation", { name: `${section} pages` }));
const current = (section: string) =>
  subtabs(section)
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "page")
    .map((b) => b.textContent);
const drawer = () => within(screen.getByRole("dialog", { name: "Menu", hidden: true }));
const openDrawer = () => fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Menu" }));
const drawerSection = (name: string) => {
  openDrawer();
  fireEvent.click(within(drawer().getByRole("navigation", { name: "Main" })).getByRole("button", { name }));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  signIn(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("phone section sub-tabs", () => {
  it.each(SECTIONS.filter((s) => !s.account && s.pages.length > 1).map((s) => [s.label, s.pages.map((p) => p.short ?? p.label)] as const))(
    "%s shows its subpages as tabs and renders one at a time",
    async (section, labels) => {
      renderPhone();
      drawerSection(section);
      expect(title()).toBe(section);
      expect(subtabs(section).getAllByRole("button").map((b) => b.textContent)).toEqual(labels);
      expect(current(section)).toEqual([labels[0]]);

      for (const label of labels) {
        fireEvent.click(subtabs(section).getByRole("button", { name: label }));
        await waitFor(() => expect(current(section)).toEqual([label]));
        expect(shown()).toHaveLength(1);
        expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
      }
    },
  );

  it("opens Ices on the overview, then shows only the standings once that tab is picked", async () => {
    renderPhone();
    drawerSection("Ices");
    expect(subtabs("Ices").getAllByRole("button")[0].textContent).toBe("Overview");
    expect(current("Ices")).toEqual(["Overview"]);
    expect(await top().findByRole("list", { name: "Who owes now" })).toBeTruthy();
    expect(top().queryByRole("list", { name: "Ice standings" })).toBeNull();
    expect(top().queryByRole("list", { name: "Chug videos" })).toBeNull();
    expect(window.location.search).toBe("?open=ices-overview");

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Standings" }));
    expect(await top().findByRole("list", { name: "Ice standings" })).toBeTruthy();
    expect(top().queryByRole("list", { name: "Who owes now" })).toBeNull();
    expect(window.location.search).toBe("?open=ice-standings");
    expect(title()).toBe("Ices");

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Videos" }));
    expect(window.location.search).toBe("?open=videos");

    act(() => window.history.back());
    await waitFor(() => expect(current("Ices")).toEqual(["Standings"]));
    expect(window.location.search).toBe("?open=ice-standings");
    act(() => window.history.forward());
    await waitFor(() => expect(current("Ices")).toEqual(["Videos"]));
  });

  it.each([
    ["?open=chug-rankings", "Ices", "Rankings"],
    ["?open=ices-overview", "Ices", "Overview"],
    ["?open=ices", "Ices", "Ledger"],
    ["?open=recap", "League", "Recap"],
    ["?open=news", "League", "News"],
    ["?open=writeup", "News Drop", "Latest"],
    ["?open=week:2", "Games", "Week"],
  ])("deep link %s selects %s > %s", (search, section, label) => {
    window.history.replaceState(null, "", `/${search}`);
    renderPhone();
    expect(title()).toBe(section);
    expect(current(section)).toEqual([label]);
  });

  it("keeps the section's tab lit under a drill-down, with Back to return", async () => {
    renderPhone();
    drawerSection("League");
    const standings = await top().findByRole("list", { name: /League standings/ });
    fireEvent.click(within(standings).getByRole("button", { name: /Team 6/ }));

    await waitFor(() => expect(title()).toBe("Team 6"));
    expect(window.location.search).toBe("?open=standings,team:6");
    expect(current("League")).toEqual(["Standings"]);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(title()).toBe("League"));
    expect(window.location.search).toBe("?open=standings");
    expect(current("League")).toEqual(["Standings"]);
  });

  it("has no sub-tabs on Home", () => {
    renderPhone();
    expect(screen.queryByRole("navigation", { name: /pages$/ })).toBeNull();
  });
});

describe("Glacier phone drawer", () => {
  it("lists only the sections and the account items", async () => {
    renderPhone();
    openDrawer();
    await drawer().findByRole("button", { name: "Sign out" });
    const main = within(drawer().getByRole("navigation", { name: "Main" }));
    expect(main.getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "League", "News Drop"]);
    expect(main.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    const account = within(drawer().getByRole("navigation", { name: "Account" }));
    expect(account.getAllByRole("button").map((b) => b.textContent)).toEqual(["My Profile", "Settings", "Classic XP", "Glacier", "Sign out"]);
    for (const name of ["Standings", "Brackets", "Stats", "Rankings", "Week view", "Mute sounds"]) {
      expect(drawer().queryByRole("button", { name })).toBeNull();
    }
  });

  it("adds the Control Panel for an admin", async () => {
    signIn(true);
    renderPhone();
    openDrawer();
    const account = within(drawer().getByRole("navigation", { name: "Account" }));
    expect(await account.findByRole("button", { name: "Control Panel" })).toBeTruthy();
  });

  it("opens a section on its default subpage, even after another was picked", () => {
    renderPhone();
    drawerSection("Games");
    fireEvent.click(subtabs("Games").getByRole("button", { name: "Brackets" }));
    drawerSection("Games");
    expect(current("Games")).toEqual(["This week"]);
    expect(window.location.search).toBe("?open=watch");
  });

  it("opens My Profile over the current page with Back", async () => {
    renderPhone();
    drawerSection("Ices");
    openDrawer();
    fireEvent.click(drawer().getByRole("button", { name: "My Profile" }));
    await waitFor(() => expect(title()).toBe("My Profile"));
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});

const inject = (...files: string[]) => {
  const style = document.createElement("style");
  style.textContent = files.map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
  document.head.append(style);
};
const THEME_CSS = { xp: ["mobile.css"], glacier: ["mobile.css", "../glacier/glacier-phone.css"] };

describe("XP phone", () => {
  it("has no tab bar: a hamburger in the title bar opens an XP drawer that keeps focus", async () => {
    renderPhone("xp");
    expect(screen.queryByRole("navigation", { name: "Tabs" })).toBeNull();
    const burger = within(screen.getByRole("banner")).getByRole("button", { name: "Menu" });
    expect(burger.getAttribute("aria-expanded")).toBe("false");

    burger.focus();
    openDrawer();
    expect(burger.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog.closest(".m-app")!.classList.contains("glacier")).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await drawer().findByRole("button", { name: "Sign out" });
    const main = within(drawer().getByRole("navigation", { name: "Main" }));
    expect(main.getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "League", "News Drop"]);
    const account = within(drawer().getByRole("navigation", { name: "Account" }));
    expect(account.getAllByRole("button").map((b) => b.textContent)).toEqual(["My Profile", "Settings", "Classic XP", "Glacier", "Sign out"]);

    const all = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled])")];
    all[all.length - 1].focus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(all[all.length - 1]);

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(dialog.closest(".gp-drawer")!.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(burger);
  });

  it("adds the Control Panel to the drawer for an admin", async () => {
    signIn(true);
    renderPhone("xp");
    openDrawer();
    expect(await within(drawer().getByRole("navigation", { name: "Account" })).findByRole("button", { name: "Control Panel" })).toBeTruthy();
  });

  it("opens Ices from the drawer with XP sub-tabs, one page at a time", async () => {
    renderPhone("xp");
    drawerSection("Ices");
    expect(title()).toBe("Ices");
    expect(current("Ices")).toEqual(["Overview"]);
    expect(await top().findByRole("list", { name: "Who owes now" })).toBeTruthy();

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Rankings" }));
    expect(window.location.search).toBe("?open=chug-rankings");
    expect(document.activeElement).toBe(subtabs("Ices").getByRole("button", { name: "Rankings" }));
  });

  it("opens My Profile from the drawer over the current page with Back", async () => {
    renderPhone("xp");
    drawerSection("League");
    openDrawer();
    fireEvent.click(drawer().getByRole("button", { name: "My Profile" }));
    await waitFor(() => expect(title()).toBe("My Profile"));
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});

describe.each(["xp", "glacier"] as const)("sub-tab grid, %s phone", (theme) => {
  it("lays Ices' six pages out three across, every one on screen with no sideways scroll", () => {
    inject(...THEME_CSS[theme]);
    window.history.replaceState(null, "", "/?open=ices-overview");
    renderPhone(theme);
    const grid = screen.getByRole("navigation", { name: "Ices pages" });
    expect(within(grid).getAllByRole("button").map((b) => b.textContent)).toEqual(["Overview", "Ledger", "Standings", "Rankings", "Stats", "Videos"]);
    const style = getComputedStyle(grid);
    expect(style.display).toBe("grid");
    expect(style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(style.overflowX).not.toMatch(/auto|scroll/);
  });

  it("puts Games' four pages two by two", () => {
    inject(...THEME_CSS[theme]);
    window.history.replaceState(null, "", "/?open=watch");
    renderPhone(theme);
    const grid = screen.getByRole("navigation", { name: "Games pages" });
    expect(within(grid).getAllByRole("button").map((b) => b.textContent)).toEqual(["This week", "Scores", "Week", "Brackets"]);
    expect(getComputedStyle(grid).gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("scrolls away with the page instead of sitting over it", () => {
    window.history.replaceState(null, "", "/?open=ices-overview");
    renderPhone(theme);
    expect(shown()[0].contains(screen.getByRole("navigation", { name: "Ices pages" }))).toBe(true);
  });
});

describe("page descriptions", () => {
  const pages = SECTIONS.flatMap((s) => s.pages.map((p) => [s.label, p.label, p] as const));

  it.each(pages)("%s > %s has a one-line description", (_, __, page) => {
    expect(page.description).toMatch(/^[A-Z].{15,90}[.]$/);
  });

  // Alternating themes covers both without rendering every page twice.
  const opened = pages.filter(([, , p]) => p.kind !== "home").map(([s, l, p], i) => [s, l, i % 2 ? "xp" : "glacier", p] as const);

  it.each(opened)("%s > %s shows its description on the %s phone", async (_, __, theme, page) => {
    signIn(true);
    window.history.replaceState(null, "", `/?open=${page.kind === "week" ? "week:2" : page.kind}`);
    renderPhone(theme);
    expect(await top().findByText(page.description)).toBeTruthy();
  });
});

