import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

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
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import Home from "@/app/page";
import { AuthGate } from "@/components/auth/auth-gate";
import { getMe, type Profile, updateMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { THEME_KEY } from "@/lib/theme/theme";

const profile = (theme: Profile["theme"]): Profile => ({
  name: "Member",
  username: "member",
  rosterId: 1,
  theme,
  createdAt: "",
  updatedAt: "",
});

function renderApp(theme: Profile["theme"]) {
  vi.mocked(getMe).mockResolvedValue({ sub: "u", email: "member@example.com", isAdmin: false, profile: profile(theme) });
  render(
    <DesktopProvider>
      <AuthGate>
        <Home />
      </AuthGate>
    </DesktopProvider>,
  );
}

// Under reduced motion the switch goes through runThemeTransition but applies at
// once, since jsdom has no View Transitions; without it every switch waits 1.2s.
const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const glacierNav = () => screen.queryByRole("navigation", { name: "Main" });
const taskbar = () => screen.queryByRole("list", { name: "Open windows" });

beforeEach(() => {
  reducedMotion(true);
  stubSleeper();
  localStorage.clear();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  reducedMotion(false);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("switching themes in the app", () => {
  it("swaps the XP desktop for the Glacier shell from the Start menu, and back from Glacier's header", async () => {
    vi.mocked(updateMe).mockImplementation(async (input) => profile("theme" in input ? input.theme : null));
    renderApp("xp");
    await screen.findByRole("list", { name: "Open windows" });

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    const menu = within(screen.getByRole("navigation", { name: "Start menu" }));
    fireEvent.click(menu.getByRole("button", { name: "Glacier" }));

    expect(glacierNav()).not.toBeNull();
    expect(taskbar()).toBeNull();
    expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" });

    // A switch in the same tick as the last one is dropped as still running.
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByRole("button", { name: "Classic XP" }));
    expect(glacierNav()).toBeNull();
    expect(taskbar()).not.toBeNull();
    expect(updateMe).toHaveBeenLastCalledWith({ theme: "xp" });
  });

  it("switches from the taskbar tray", async () => {
    vi.mocked(updateMe).mockResolvedValue(profile("glacier"));
    renderApp("xp");
    await screen.findByRole("list", { name: "Open windows" });

    fireEvent.click(screen.getByRole("button", { name: "Switch to the Glacier theme" }));
    expect(glacierNav()).not.toBeNull();
  });

  it("opens in the profile's theme even when this browser stored the other", async () => {
    localStorage.setItem(THEME_KEY, "xp");
    renderApp("glacier");
    expect(await screen.findByRole("navigation", { name: "Main" })).not.toBeNull();
    expect(taskbar()).toBeNull();
  });

  it("goes back to XP when the profile save fails", async () => {
    vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
    renderApp("xp");
    await screen.findByRole("list", { name: "Open windows" });

    fireEvent.click(screen.getByRole("button", { name: "Switch to the Glacier theme" }));
    expect(await screen.findByRole("list", { name: "Open windows" })).not.toBeNull();
    expect(glacierNav()).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe("xp");
  });
});
