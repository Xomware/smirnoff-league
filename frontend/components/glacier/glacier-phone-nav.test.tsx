import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";

function renderGlacier() {
  return render(
    <ProfileProvider>
      <NotificationsProvider>
        <MobileShell theme="glacier" />
      </NotificationsProvider>
    </ProfileProvider>,
  );
}

const burger = () => within(screen.getByRole("banner")).getByRole("button", { name: "Menu" });
const drawer = () => screen.getByRole("dialog", { name: "Menu", hidden: true });
const isOpen = () => !drawer().closest(".gp-drawer")!.hasAttribute("inert");
const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const focusables = () => [...drawer().querySelectorAll<HTMLElement>("button:not([disabled]), a[href], select, input")];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Thirteen", username: "t", rosterId: 13, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("Glacier phone header", () => {
  it("has no tab bar: a hamburger in the header opens the drawer", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(join(__dirname, "glacier-phone.css"), "utf8");
    document.head.append(style);
    renderGlacier();

    expect(screen.queryByRole("navigation", { name: "Tabs" })).toBeNull();
    expect(burger().getAttribute("aria-haspopup")).toBe("dialog");
    expect(getComputedStyle(screen.getByRole("banner")).minHeight).toBe("calc(56px + env(safe-area-inset-top))");
  });

  it("shrinks once the page scrolls, and grows back at the top", () => {
    renderGlacier();
    const page = document.querySelector<HTMLElement>(".m-screen:not([hidden])")!;

    page.scrollTop = 200;
    fireEvent.scroll(page);
    expect(screen.getByRole("banner").hasAttribute("data-scrolled")).toBe(true);

    page.scrollTop = 0;
    fireEvent.scroll(page);
    expect(screen.getByRole("banner").hasAttribute("data-scrolled")).toBe(false);
  });

  it("puts Home, Games, Ices and League first in the drawer", async () => {
    renderGlacier();
    fireEvent.click(burger());
    const quick = within(within(drawer()).getByRole("navigation", { name: "Main" }));
    expect(quick.getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Games", "Ices", "League"]);
    expect(quick.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");

    fireEvent.click(quick.getByRole("button", { name: "Games" }));
    expect(isOpen()).toBe(false);
    expect(title()).toBe("Games");

    fireEvent.click(burger());
    fireEvent.click(quick.getByRole("button", { name: "League" }));
    await waitFor(() => expect(title()).toBe("League Standings"));
  });
});

describe("Glacier phone home", () => {
  it("shows each section as a short carousel with a See all", async () => {
    renderGlacier();
    const standings = within(await screen.findByRole("region", { name: "Ice standings" }));
    const list = await standings.findByRole("list", { name: "Top of the ice standings" });
    expect(list.classList.contains("gh-carousel")).toBe(true);
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    fireEvent.click(standings.getByRole("button", { name: /^See all/ }));
    expect(title()).toBe("Ices");
  });
});

describe("Glacier phone menu drawer", () => {
  it("opens from the hamburger without leaving the current screen, focus inside", async () => {
    renderGlacier();
    expect(isOpen()).toBe(false);
    expect(burger().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(burger());

    expect(isOpen()).toBe(true);
    expect(burger().getAttribute("aria-expanded")).toBe("true");
    expect(drawer().getAttribute("aria-modal")).toBe("true");
    expect(title()).toBe("Smirnoff League");
    expect(drawer().contains(document.activeElement)).toBe(true);
    expect(await within(drawer()).findByRole("button", { name: /Standings/ })).toBeTruthy();
  });

  it("keeps Tab and Shift+Tab inside the drawer", async () => {
    renderGlacier();
    fireEvent.click(burger());
    await within(drawer()).findByRole("button", { name: /Standings/ });
    const all = focusables();
    const [first, last] = [all[0], all[all.length - 1]];

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("closes on Escape and hands focus back to the hamburger", () => {
    renderGlacier();
    burger().focus();
    fireEvent.click(burger());

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(burger());
  });

  it("closes on the overlay and on its close button", () => {
    const { container } = renderGlacier();
    fireEvent.click(burger());
    fireEvent.click(container.querySelector(".gp-drawer-scrim")!);
    expect(isOpen()).toBe(false);

    fireEvent.click(burger());
    fireEvent.click(within(drawer()).getByRole("button", { name: "Close menu" }));
    expect(isOpen()).toBe(false);
  });

  it("opens a row's screen over the current tab and closes", async () => {
    renderGlacier();
    fireEvent.click(burger());
    fireEvent.click(await within(drawer()).findByRole("button", { name: /Brackets/ }));

    await waitFor(() => expect(title()).toBe("Brackets"));
    expect(isOpen()).toBe(false);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
