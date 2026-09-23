import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
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
import { REGISTRY } from "@/lib/desktop/registry";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { foldedInto } from "@/lib/phone/nav";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { GlacierShell } from "./GlacierShell";

const wrap = (shell: ReactNode) =>
  render(
    <ProfileProvider>
      <NotificationsProvider>{shell}</NotificationsProvider>
    </ProfileProvider>,
  );

// What the URL shows now: the last window it names, by kind.
const shownKind = () => new URLSearchParams(window.location.search).get("open")?.split(",").at(-1)?.split(":")[0] ?? "home";
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const main = () => within(screen.getByRole("navigation", { name: "Main" }));
const section = () => main().getAllByRole("link").find((a) => a.getAttribute("aria-current") === "page")?.textContent;

// Pages that open from a row inside another page, never from a menu. The
// drill tests below cover team, player and game; the Ices folder only lists
// pages that the Ices sub-nav already links.
const DRILLED = ["folder", "game", "player", "team"];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: true,
    profile: { name: "Me", username: "me", rosterId: 13, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Glacier reachability", () => {
  it("reaches every registry kind from the main nav, a sub-nav or the account menu", async () => {
    wrap(<GlacierShell />);
    const reached = new Set<string>();
    const visitSubNav = () => {
      const sub = screen.queryByRole("navigation", { name: / pages$/ });
      if (!sub) return;
      for (const label of within(sub).getAllByRole("link").map((a) => a.textContent!)) {
        fireEvent.click(within(screen.getByRole("navigation", { name: / pages$/ })).getByRole("link", { name: label }));
        reached.add(shownKind());
      }
    };

    for (const label of main().getAllByRole("link").map((a) => a.textContent!)) {
      fireEvent.click(main().getByRole("link", { name: label }));
      reached.add(shownKind());
      visitSubNav();
    }
    const account = await screen.findByRole("button", { name: "Me, account menu" });
    const items = () => within(screen.getByRole("navigation", { name: "Account" }));
    fireEvent.click(account);
    for (const label of items().getAllByRole("link").map((a) => a.textContent!)) {
      if (!screen.queryByRole("navigation", { name: "Account" })) fireEvent.click(account);
      fireEvent.click(items().getByRole("link", { name: label }));
      reached.add(shownKind());
    }
    visitSubNav();

    expect(Object.keys(REGISTRY).filter((kind) => !reached.has(kind)).sort()).toEqual(DRILLED);
    expect(reached).toContain("teams");
    expect(reached).toContain("settings");
  }, 20000);

  it("drills from a Standings row to a team in place, lit as League, with Back and Forward", async () => {
    window.history.replaceState(null, "", "/?open=standings");
    wrap(<GlacierShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Team 6/ }));

    expect(heading()).toBe("Team Profile - Team 6");
    expect(window.location.search).toBe("?open=team:6");
    expect(section()).toBe("League");

    window.history.back();
    await waitFor(() => expect(heading()).toBe("League Standings"));
    window.history.forward();
    await waitFor(() => expect(heading()).toBe("Team Profile - Team 6"));
  });

  it("lights Games for a game, and keeps a player card in the section it opened from", async () => {
    window.history.replaceState(null, "", "/?open=team:6");
    wrap(<GlacierShell />);
    expect(section()).toBe("League");
    const results = await screen.findByRole("table", { name: "Weekly results" });

    fireEvent.click(within(results).getByRole("button", { name: /Romeo Doubs/ }));
    expect(window.location.search).toBe("?open=player:8121");
    expect(section()).toBe("League");

    window.history.back();
    await waitFor(() => expect(heading()).toBe("Team Profile - Team 6"));
    fireEvent.click(within(await screen.findByRole("table", { name: "Weekly results" })).getByRole("button", { name: "91.46 - 134.46" }));
    expect(window.location.search).toBe("?open=game:1-7");
    expect(section()).toBe("Games");

    fireEvent.click((await screen.findAllByRole("button", { name: /Romeo Doubs/ }))[0]);
    expect(window.location.search).toBe("?open=player:8121");
    expect(section()).toBe("Games");
  });
});

describe("phone Menu reachability", () => {
  it("lists every section's pages plus Settings, My Profile and the Control Panel", async () => {
    wrap(<MobileShell theme="glacier" />);
    const tab = (name: string) => within(screen.getByRole("navigation", { name: "Tabs" })).getByRole("button", { name });
    const top = () => within(document.querySelector<HTMLElement>(".m-screen:not([hidden])")!);
    fireEvent.click(tab("Menu"));
    await top().findByRole("heading", { name: "Me" });
    expect(top().getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Games", "Ices", "League", "News Drop", "Me"]);

    // The tab bar reaches what the Home, Games and Ices tabs show, and the bell notifications.
    const kinds = Object.keys(REGISTRY) as (keyof typeof REGISTRY)[];
    const reached = new Set<string>(["notifications", ...kinds.filter((k) => foldedInto(k))]);
    const labels = top()
      .getAllByRole("button")
      .filter((b) => b.querySelector(".m-chevron"))
      .map((b) => b.textContent!);
    expect(labels).toEqual(expect.arrayContaining(["My Profile", "Settings", "Control Panel", "Teams", "Draft recap", "Week view"]));
    for (const label of labels) {
      // Tapping the tab you are on goes back to its root.
      fireEvent.click(tab("Menu"));
      if (heading() !== "Menu") fireEvent.click(tab("Menu"));
      await waitFor(() => expect(shownKind()).toBe("menu"));
      fireEvent.click(top().getByRole("button", { name: label }));
      await waitFor(() => expect(shownKind()).not.toBe("menu"));
      reached.add(shownKind());
    }

    expect(Object.keys(REGISTRY).filter((kind) => !reached.has(kind)).sort()).toEqual(["game", "player", "team"]);
  }, 20000);
});
