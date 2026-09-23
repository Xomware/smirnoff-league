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

const tabBar = () => screen.getByRole("navigation", { name: "Tabs" });
const menuTab = () => within(tabBar()).getByRole("button", { name: "Menu" });
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

describe("Glacier phone tab bar", () => {
  it("docks flush to the bottom edge, full width and opaque, padded for the home indicator", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(join(__dirname, "glacier-phone.css"), "utf8");
    document.head.append(style);
    renderGlacier();

    const bar = getComputedStyle(tabBar());
    expect(bar.position).toBe("absolute");
    expect([bar.bottom, bar.left, bar.right]).toEqual(["0px", "0px", "0px"]);
    expect(bar.borderRadius).toBe("0px");
    expect(bar.paddingBottom).toContain("env(safe-area-inset-bottom)");
    expect(bar.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});

describe("Glacier phone menu drawer", () => {
  it("opens from the Menu tab without leaving the current screen, focus inside", async () => {
    renderGlacier();
    expect(isOpen()).toBe(false);
    expect(menuTab().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(menuTab());

    expect(isOpen()).toBe(true);
    expect(menuTab().getAttribute("aria-expanded")).toBe("true");
    expect(drawer().getAttribute("aria-modal")).toBe("true");
    expect(title()).toBe("Smirnoff League");
    expect(drawer().contains(document.activeElement)).toBe(true);
    expect(await within(drawer()).findByRole("button", { name: /Standings/ })).toBeTruthy();
  });

  it("keeps Tab and Shift+Tab inside the drawer", async () => {
    renderGlacier();
    fireEvent.click(menuTab());
    await within(drawer()).findByRole("button", { name: /Standings/ });
    const all = focusables();
    const [first, last] = [all[0], all[all.length - 1]];

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("closes on Escape and hands focus back to the Menu tab", () => {
    renderGlacier();
    menuTab().focus();
    fireEvent.click(menuTab());

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(menuTab());
  });

  it("closes on the overlay and on its close button", () => {
    const { container } = renderGlacier();
    fireEvent.click(menuTab());
    fireEvent.click(container.querySelector(".gp-drawer-scrim")!);
    expect(isOpen()).toBe(false);

    fireEvent.click(menuTab());
    fireEvent.click(within(drawer()).getByRole("button", { name: "Close menu" }));
    expect(isOpen()).toBe(false);
  });

  it("opens a row's screen over the current tab and closes", async () => {
    renderGlacier();
    fireEvent.click(menuTab());
    fireEvent.click(await within(drawer()).findByRole("button", { name: /Brackets/ }));

    await waitFor(() => expect(title()).toBe("Brackets"));
    expect(isOpen()).toBe(false);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
