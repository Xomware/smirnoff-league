import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { Desktop } from "@/components/desktop/Desktop";
import { GlacierShell } from "@/components/glacier/GlacierShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { stubSleeper } from "@/lib/test/league-mock";

const SHELLS: Record<string, () => ReactNode> = {
  "XP desktop": () => (
    <DesktopProvider>
      <Desktop />
    </DesktopProvider>
  ),
  "Glacier desktop": () => <GlacierShell />,
  "XP phone": () => <MobileShell theme="xp" />,
  "Glacier phone": () => <MobileShell theme="glacier" />,
};
type Shell = keyof typeof SHELLS;
const PHONES: Shell[] = ["XP phone", "Glacier phone"];

function open(shell: Shell, search: string) {
  window.history.replaceState(null, "", `/${search}`);
  render(
    <ProfileProvider>
      <NotificationsProvider>{SHELLS[shell]()}</NotificationsProvider>
    </ProfileProvider>,
  );
}

const strip = (label: string) => within(screen.getByRole("tablist", { name: label }));
const selected = (label: string) =>
  strip(label)
    .getAllByRole("tab")
    .filter((t) => t.getAttribute("aria-selected") === "true")
    .map((t) => t.textContent);
const openParam = () => new URLSearchParams(window.location.search).get("open")?.split(",").at(-1);

// Each test renders a whole shell, which CI runs several times slower than a laptop.
vi.setConfig({ testTimeout: 20000 });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
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

describe.each(Object.keys(SHELLS) as Shell[])("inner tabs, %s", (shell) => {
  it("opens Ice Stats on the Overview and renders only that section", async () => {
    open(shell, "?open=stats");
    await screen.findByRole("tablist", { name: "Ice Stats sections" });
    expect(selected("Ice Stats sections")).toEqual(["Overview"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("region", { name: /Heat Check/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Position Risk" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Ice Stats sections" })).toBeNull();
  });

  it("puts the picked Stats tab in ?open= and follows a deep link to it", async () => {
    open(shell, "?open=stats:positions");
    await screen.findByRole("tablist", { name: "Ice Stats sections" });
    expect(selected("Ice Stats sections")).toEqual(["Positions"]);
    expect(screen.getByRole("region", { name: "Position Risk" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Heat Check/ })).toBeNull();

    fireEvent.click(strip("Ice Stats sections").getByRole("tab", { name: "Hall of Shame" }));
    await waitFor(() => expect(openParam()).toBe("stats:hall-of-shame"));
    expect(selected("Ice Stats sections")).toEqual(["Hall of Shame"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Position Risk" })).toBeNull();
  });

  it("keeps the arrow keys moving focus along the strip", async () => {
    open(shell, "?open=stats");
    await screen.findByRole("tablist", { name: "Ice Stats sections" });
    const overview = strip("Ice Stats sections").getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    await waitFor(() => expect(openParam()).toBe("stats:race"));
    expect(document.activeElement).toBe(strip("Ice Stats sections").getByRole("tab", { name: "Race" }));
  });

  it("deep links a team page to its Ices tab and writes a switch back to the link", async () => {
    open(shell, "?open=team:6:ices");
    const label = (await screen.findByRole("tablist", { name: /^Team 6/ })).getAttribute("aria-label")!;
    expect(selected(label)).toEqual(["Ices"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.queryByRole("table", { name: "Weekly results" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Weekly results" })).toBeNull();

    fireEvent.click(strip(label).getByRole("tab", { name: "Results" }));
    await waitFor(() => expect(openParam()).toBe("team:6:results"));
    expect(await screen.findByRole(PHONES.includes(shell) ? "list" : "table", { name: "Weekly results" })).toBeTruthy();
  });

  it("opens a team page with no tab named on its first tab", async () => {
    open(shell, "?open=team:6");
    const label = (await screen.findByRole("tablist", { name: /^Team 6/ })).getAttribute("aria-label")!;
    expect(selected(label)).toEqual(["Results"]);
    expect(openParam()).toBe("team:6");
  });
});

describe.each(PHONES)("inner tabs survive history, %s", (shell) => {
  it("comes back from a player to the team tab it left", async () => {
    open(shell, "?open=team:6");
    const label = (await screen.findByRole("tablist", { name: /^Team 6/ })).getAttribute("aria-label")!;
    fireEvent.click(strip(label).getByRole("tab", { name: "Lineup" }));
    await waitFor(() => expect(openParam()).toBe("team:6:roster"));

    const starters = await screen.findByRole("list", { name: /^Starters/ });
    fireEvent.click(within(starters).getAllByRole("button")[0]);
    await waitFor(() => expect(openParam()).toMatch(/^player:/));

    act(() => window.history.back());
    await waitFor(() => expect(openParam()).toBe("team:6:roster"));
    expect(selected(label)).toEqual(["Lineup"]);
    expect(screen.getByRole("list", { name: /^Starters/ })).toBeTruthy();
  });
});

describe("inner tabs survive history, Glacier desktop", () => {
  it("comes back from a player to the team tab it left, and forward again", async () => {
    open("Glacier desktop", "?open=team:6");
    const label = (await screen.findByRole("tablist", { name: /^Team 6/ })).getAttribute("aria-label")!;
    fireEvent.click(strip(label).getByRole("tab", { name: "Roster" }));
    await waitFor(() => expect(openParam()).toBe("team:6:roster"));

    const starters = await screen.findByRole("list", { name: /^Starters/ });
    fireEvent.click(within(starters).getAllByRole("button")[0]);
    await waitFor(() => expect(openParam()).toMatch(/^player:/));

    act(() => window.history.back());
    await waitFor(() => expect(openParam()).toBe("team:6:roster"));
    await screen.findByRole("tablist", { name: label });
    expect(selected(label)).toEqual(["Roster"]);
    act(() => window.history.forward());
    await waitFor(() => expect(openParam()).toMatch(/^player:/));
  });
});

describe("inner tabs, window history on the XP desktop", () => {
  it("returns a window to the team tab it drilled from", async () => {
    open("XP desktop", "?open=team:6:roster");
    const label = (await screen.findByRole("tablist", { name: /^Team 6/ })).getAttribute("aria-label")!;
    const starters = await screen.findByRole("list", { name: /^Starters/ });
    fireEvent.click(within(starters).getAllByRole("button")[0]);
    await waitFor(() => expect(openParam()).toMatch(/^player:/));

    fireEvent.click(screen.getAllByRole("button", { name: "Back" }).at(-1)!);
    await waitFor(() => expect(openParam()).toBe("team:6:roster"));
    await screen.findByRole("tablist", { name: label });
    expect(selected(label)).toEqual(["Roster"]);
  });
});

describe("inner tab styles", () => {
  it.each([
    ["XP desktop", null],
    ["XP phone", null],
    ["Glacier desktop", "glacier"],
    ["Glacier phone", "glacier"],
  ] as const)("%s renders the theme's tab strip", async (shell, theme) => {
    open(shell, "?open=stats");
    const list = await screen.findByRole("tablist", { name: "Ice Stats sections" });
    expect(list.classList.contains("xp-tab-strip")).toBe(true);
    expect(list.closest("[data-theme]")?.getAttribute("data-theme") ?? null).toBe(theme);
  });

  it("keeps Glacier's phone sub-tabs and the inner tabs as two separate strips", async () => {
    open("Glacier phone", "?open=stats");
    const inner = await screen.findByRole("tablist", { name: "Ice Stats sections" });
    const pages = screen.getByRole("navigation", { name: "Ices pages" });
    expect(pages.contains(inner)).toBe(false);
    expect(inner.classList.contains("m-subtabs")).toBe(false);
  });
});
