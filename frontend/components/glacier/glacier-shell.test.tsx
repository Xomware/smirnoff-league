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

import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe, updateMe } from "@/lib/api/users";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { GlacierShell } from "./GlacierShell";

function renderShell() {
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

const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const nav = () => within(screen.getByRole("navigation", { name: "Main" }));
const account = () => screen.getByRole("button", { name: /account menu/ });
const menu = () => within(screen.getByRole("navigation", { name: "Account" }));
const asAdmin = () =>
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: true,
    profile: { name: "Me", username: "me", rosterId: 13, createdAt: "", updatedAt: "" },
  });
const box = () => screen.getByRole("combobox", { name: "Search" });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Me", username: "me", rosterId: 13, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("GlacierShell", () => {
  it("marks its root as the Glacier theme and lists the five sections", () => {
    const { container } = renderShell();
    expect(container.firstElementChild!.getAttribute("data-theme")).toBe("glacier");
    expect(nav().getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Games", "Ices", "League", "News Drop"]);
    expect(nav().getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  });

  it("switches the view from the nav, writes ?open= and comes back on the browser's Back", async () => {
    renderShell();
    fireEvent.click(nav().getByRole("link", { name: "League" }));

    expect(heading()).toBe("League Standings");
    expect(window.location.search).toBe("?open=standings");
    expect(nav().getByRole("link", { name: "League" }).getAttribute("aria-current")).toBe("page");
    expect(nav().getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();

    window.history.back();
    await waitFor(() => expect(heading()).toBe("Every zero is an ice."));
  });

  it("opens the view a deep link names", () => {
    window.history.replaceState(null, "", "/?open=chug-rankings");
    renderShell();
    expect(heading()).toBe("Ice Rankings");
    expect(nav().getByRole("link", { name: "Ices" }).getAttribute("aria-current")).toBe("page");
    const sub = within(screen.getByRole("navigation", { name: "Ices pages" }));
    expect(sub.getByRole("link", { name: "Rankings" }).getAttribute("aria-current")).toBe("page");
  });

  it("says what a page holds under its title", async () => {
    window.history.replaceState(null, "", "/?open=ices");
    renderShell();
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.nextElementSibling?.textContent).toBe("Every ice, week by week. Tap a week to open it.");

    fireEvent.click(nav().getByRole("link", { name: "League" }));
    await waitFor(() => expect(heading()).toBe("League Standings"));
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling?.textContent).toBe("Records and points for, with the playoff line drawn in.");
  });

  it("opens the palette on Cmd+K and goes where the pick points", async () => {
    renderShell();
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    fireEvent.change(box(), { target: { value: "news drop" } });
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option").length).toBeGreaterThan(0));
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);

    await waitFor(() => expect(heading()).toBe("Smirnoff League - Latest Edition"));
    expect(window.location.search).toBe("?open=writeup");
  });

  it("opens notifications from the bell and carries the theme switch in the account menu", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(heading()).toBe("Notifications");

    expect(screen.queryByRole("group", { name: "Theme" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Me, account menu" }));
    expect(within(menu().getByRole("group", { name: "Theme" })).getByRole("button", { name: "Classic XP" })).toBeTruthy();
  });

  it("puts the signed-in manager top right, with their pages and Sign out", async () => {
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "Me, account menu" }));

    expect(account().getAttribute("aria-expanded")).toBe("true");
    expect(menu().getAllByRole("link").map((a) => a.textContent)).toEqual(["My Profile", "My Team", "Settings"]);
    expect(menu().getByRole("button", { name: "Sign out" })).toBeTruthy();

    fireEvent.click(menu().getByRole("link", { name: "My Team" }));
    expect(heading()).toMatch(/^My Team/);
    expect(window.location.search).toBe("?open=my-team");
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
  });

  it("closes the account menu on Escape and hands focus back", async () => {
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "Me, account menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
    expect(document.activeElement).toBe(account());
  });

  it("offers the Control Panel only to an admin", async () => {
    asAdmin();
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "Me, account menu" }));
    fireEvent.click(menu().getByRole("link", { name: "Admin" }));
    expect(heading()).toBe("Control Panel");
    expect(window.location.search).toBe("?open=admin");
  });

  it("renders Settings from a deep link: email alerts, theme and sound", async () => {
    window.history.replaceState(null, "", "/?open=settings");
    renderShell();
    expect(heading()).toBe("Settings");
    expect(await screen.findByRole("checkbox", { name: /Email me alerts/ })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Send an email" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Appearance" })).getByRole("group", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Play sounds" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "League admin" })).toBeNull();
  });

  it("links an admin from Settings to the Control Panel", async () => {
    asAdmin();
    window.history.replaceState(null, "", "/?open=settings");
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "Open the Control Panel" }));
    expect(heading()).toBe("Control Panel");
  });

  it("edits the profile in place and saves it", async () => {
    vi.mocked(updateMe).mockResolvedValue({ name: "Me Too", username: "me", rosterId: 13, createdAt: "", updatedAt: "" });
    window.history.replaceState(null, "", "/?open=profile");
    renderShell();
    expect(heading()).toBe("My Profile");

    const name = await screen.findByRole("textbox", { name: "Full name" });
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(updateMe).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: " Me Too " } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(updateMe).toHaveBeenCalledWith({ name: "Me Too", username: "me", rosterId: 13 });
  });
});
