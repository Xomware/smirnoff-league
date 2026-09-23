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

import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
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
const box = () => screen.getByRole("combobox", { name: "Search" });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Me", username: "m", rosterId: 13, createdAt: "", updatedAt: "" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("GlacierShell", () => {
  it("marks its root as the Glacier theme and lists the six pages", () => {
    const { container } = renderShell();
    expect(container.firstElementChild!.getAttribute("data-theme")).toBe("glacier");
    expect(nav().getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Games", "Ices", "Rankings", "League", "News Drop"]);
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
    expect(nav().getByRole("link", { name: "Rankings" }).getAttribute("aria-current")).toBe("page");
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

  it("opens notifications from the bell and carries the theme switch", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(heading()).toBe("Notifications");

    expect(within(screen.getByRole("group", { name: "Theme" })).getByRole("button", { name: "Classic XP" })).toBeTruthy();
  });
});
