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
  it.each(SECTIONS.filter((s) => !s.account && s.pages.length > 1).map((s) => [s.label, s.pages.map((p) => p.label)] as const))(
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

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Ice standings" }));
    expect(await top().findByRole("list", { name: "Ice standings" })).toBeTruthy();
    expect(top().queryByRole("list", { name: "Who owes now" })).toBeNull();
    expect(window.location.search).toBe("?open=ice-standings");
    expect(title()).toBe("Ices");

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Chug videos" }));
    expect(window.location.search).toBe("?open=videos");

    act(() => window.history.back());
    await waitFor(() => expect(current("Ices")).toEqual(["Ice standings"]));
    expect(window.location.search).toBe("?open=ice-standings");
    act(() => window.history.forward());
    await waitFor(() => expect(current("Ices")).toEqual(["Chug videos"]));
  });

  it.each([
    ["?open=chug-rankings", "Ices", "Rankings"],
    ["?open=ices-overview", "Ices", "Overview"],
    ["?open=ices", "Ices", "Ledger"],
    ["?open=recap", "League", "Draft recap"],
    ["?open=news", "League", "News"],
    ["?open=writeup", "News Drop", "Latest edition"],
    ["?open=week:2", "Games", "Week view"],
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

describe("XP phone", () => {
  it("keeps its four tabs and gives Ices XP sub-tabs, one page at a time", async () => {
    renderPhone("xp");
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "Menu"]);

    fireEvent.click(tabs.getByRole("button", { name: "Ices" }));
    expect(current("Ices")).toEqual(["Overview"]);
    expect(await top().findByRole("list", { name: "Who owes now" })).toBeTruthy();
    expect(top().queryByRole("list", { name: "Ice standings" })).toBeNull();

    fireEvent.click(subtabs("Ices").getByRole("button", { name: "Rankings" }));
    expect(window.location.search).toBe("?open=chug-rankings");
    expect(tabs.getByRole("button", { name: "Ices" }).getAttribute("aria-current")).toBe("page");
  });

  it("opens a League page from Menu with its sub-tabs, Menu still lit", () => {
    renderPhone("xp");
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    fireEvent.click(tabs.getByRole("button", { name: "Menu" }));
    fireEvent.click(top().getByRole("button", { name: /Draft recap/ }));
    expect(current("League")).toEqual(["Draft recap"]);
    expect(tabs.getByRole("button", { name: "Menu" }).getAttribute("aria-current")).toBe("page");
  });
});
