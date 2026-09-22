import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

const router = vi.hoisted(() => ({
  replace: (url: string) => window.history.replaceState(null, "", url),
}));

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ username: "u", userId: "u" })),
  fetchAuthSession: vi.fn(async () => ({
    tokens: { idToken: { payload: { email: "member@example.com" } } },
  })),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(async () => ({
    sub: "u",
    email: "member@example.com",
    isAdmin: false,
    profile: { name: "Member", username: "member", rosterId: 1, createdAt: "", updatedAt: "" },
  })),
}));

import { AuthGate } from "@/components/auth/auth-gate";
import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { loadLayout, saveLayout } from "@/lib/desktop/persist";
import { defaultLayout } from "@/lib/desktop/windows";
import { stubSleeper } from "@/lib/test/league-mock";
import Home from "./page";
import StandingsPage from "./standings/page";

const realStorage = localStorage;

beforeEach(() => {
  stubSleeper();
  Element.prototype.setPointerCapture = vi.fn();
  vi.spyOn(router, "replace");
});
afterEach(() => {
  vi.restoreAllMocks();
  realStorage.clear();
  vi.stubGlobal("localStorage", realStorage);
  window.history.replaceState(null, "", "/");
});

const signedIn = (page: ReactNode) => (
  <DesktopProvider>
    <AuthGate shell={<Taskbar />}>{page}</AuthGate>
  </DesktopProvider>
);

function renderAt(url: string) {
  window.history.replaceState(null, "", url);
  return render(signedIn(<Home />));
}

const tabs = () => within(screen.getByRole("list", { name: "Open windows" }));
const tabNames = () => tabs().getAllByRole("button").map((b) => b.textContent);
const focusedTab = () => tabs().getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true");
const LAYOUT_DEFAULT = ["Smirnoff Fantasy Football League", "Now Playing - Draft Recap", "League Standings", "League News"];

describe("old routes", () => {
  it("redirects /standings to the desktop with Standings focused", async () => {
    window.history.replaceState(null, "", "/standings/");
    const { rerender } = render(signedIn(<StandingsPage />));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/?open=standings"));
    expect(window.location.search).toBe("?open=standings");
    rerender(signedIn(<Home />));

    expect(await screen.findByRole("region", { name: "League Standings" })).toBeTruthy();
    expect(tabNames()).toEqual(["League Standings"]);
    expect(focusedTab()?.textContent).toBe("League Standings");
  });
});

describe("?open=", () => {
  it("opens the Team window for roster 6", async () => {
    renderAt("/?open=team:6");

    const team = await screen.findByRole("region", { name: "Team Profile" });
    expect(await within(team).findByText(/PF 194\.00/)).toBeTruthy();
    expect(focusedTab()?.textContent).toBe("Team Profile");
  });

  it("keeps the URL in sync as windows open and close", async () => {
    renderAt("/?open=standings");
    await screen.findByRole("region", { name: "League Standings" });

    fireEvent.click(screen.getByRole("button", { name: "Scores" }), { detail: 0 });
    const scores = await screen.findByRole("region", { name: "Scores" });
    expect(window.location.search).toBe("?open=standings,scores");

    fireEvent.click(within(scores).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(window.location.search).toBe("?open=standings"));
  });

  it("shows the focused window maximized on a phone", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({ matches: query.includes("max-width"), addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
    renderAt("/?open=standings,team:6");

    const team = await screen.findByRole("region", { name: "Team Profile" });
    expect(team.hidden).toBe(false);
    expect(team.dataset.maximized).toBe("true");
    // Hidden windows drop out of the accessibility tree, so find it by label.
    expect(document.querySelector<HTMLElement>('section[aria-label="League Standings"]')?.hidden).toBe(true);
  });

  it("copies a link to one window", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAt("/?open=standings,team:6");

    const team = await screen.findByRole("region", { name: "Team Profile" });
    fireEvent.click(within(team).getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?open=team:6`);
    expect(await screen.findByRole("status", { name: "Link copied" })).toBeTruthy();
  });
});

describe("saved layout", () => {
  const saved = () =>
    defaultLayout(1440, 900).map((w) => (w.id === "standings" ? { ...w, x: 5 } : w)).filter((w) => w.id !== "news");

  it("restores the user's layout, and saves changes to it", async () => {
    saveLayout("u", saved());
    renderAt("/");

    const standings = await screen.findByRole("region", { name: "League Standings" });
    expect(standings.style.left).toBe("5px");
    expect(screen.queryByRole("region", { name: "League News" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Scores" }), { detail: 0 });
    await screen.findByRole("region", { name: "Scores" });
    await waitFor(() => expect(loadLayout("u")?.map((w) => w.id)).toContain("scores"));
  });

  it("lets ?open= pick the windows, keeping their saved position", async () => {
    saveLayout("u", saved());
    renderAt("/?open=standings");

    const standings = await screen.findByRole("region", { name: "League Standings" });
    expect(standings.style.left).toBe("5px");
    expect(tabNames()).toEqual(["League Standings"]);
  });

  it("falls back to the default layout when storage throws", async () => {
    const fail = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: fail, setItem: fail });
    renderAt("/");

    for (const name of LAYOUT_DEFAULT) expect(await screen.findByRole("region", { name })).toBeTruthy();
  });

  it("resets to the default layout from the Start menu", async () => {
    saveLayout("u", saved().filter((w) => w.id === "standings"));
    renderAt("/");
    await screen.findByRole("region", { name: "League Standings" });

    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reset desktop" }));

    for (const name of LAYOUT_DEFAULT) expect(await screen.findByRole("region", { name })).toBeTruthy();
    await waitFor(() => expect(loadLayout("u")?.map((w) => w.id).sort()).toEqual(["home", "news", "recap", "standings"]));
  });
});
