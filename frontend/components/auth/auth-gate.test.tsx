// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

const nav = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import AuthCallbackPage from "@/app/auth/callback/page";
import PrivacyPage from "@/app/privacy/page";
import { track } from "@/lib/activity/tracker";
import { getMe } from "@/lib/api/users";
import { THEME_KEY } from "@/lib/theme/theme";
import { AuthGate } from "./auth-gate";

function signedIn() {
  vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: { idToken: { payload: { email: "member@example.com" } } },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>);
  vi.mocked(getMe).mockResolvedValue({
    sub: "u",
    email: "member@example.com",
    isAdmin: false,
    profile: { name: "Member", username: "member", rosterId: 1, createdAt: "", updatedAt: "" },
  });
}

function signedOut() {
  vi.mocked(getCurrentUser).mockRejectedValue(new Error("not signed in"));
  // The landing's league status fetches Sleeper; offline, it just hides.
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuthGate", () => {
  it("renders the landing on /standings when signed out", async () => {
    signedOut();
    nav.pathname = "/standings/";
    render(<AuthGate>standings content</AuthGate>);

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    expect(screen.getAllByRole("button", { name: /sign in with google/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("standings content")).toBeNull();
  });

  it("puts the theme switch on the signed-out landing, saved to this browser only", async () => {
    signedOut();
    localStorage.clear();
    nav.pathname = "/";
    const { container } = render(<AuthGate>home</AuthGate>);
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());

    const toggle = within(screen.getByRole("group", { name: "Theme" }));
    expect(toggle.getByRole("button", { name: "Classic XP" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-theme="glacier"]')).toBeNull();

    fireEvent.click(toggle.getByRole("button", { name: "Glacier" }));

    expect(container.querySelector('[data-theme="glacier"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Glacier" }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
    expect(getMe).not.toHaveBeenCalled();
    localStorage.clear();
  });

  it("renders the children when signed in", async () => {
    signedIn();
    nav.pathname = "/standings/";
    render(<AuthGate>standings content</AuthGate>);

    expect(await screen.findByText("standings content")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
  });

  it("shows the ice loader while the profile loads", async () => {
    signedIn();
    vi.mocked(getMe).mockReturnValue(new Promise(() => {}));
    nav.pathname = "/";
    render(<AuthGate>home</AuthGate>);

    expect((await screen.findByText(/loading your profile/i)).closest('[role="status"]')).not.toBeNull();
    expect(document.querySelector("main .brand-loader svg")).not.toBeNull();
    expect(document.querySelector('main img[src*="robot-head.png"]')).toBeNull();
  });

  describe("activity tracking", () => {
    const hide = () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    const trackCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/activity/track"));

    beforeEach(() => sessionStorage.clear());
    afterEach(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));

    it("never tracks the signed-out landing", async () => {
      signedOut();
      nav.pathname = "/";
      render(<AuthGate>home</AuthGate>);
      await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());

      track("open", "stats");
      hide();
      await new Promise((r) => setTimeout(r, 0));
      expect(trackCalls()).toEqual([]);
    });

    it("records the sign-in once signed in", async () => {
      signedIn();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: {}, error: null, meta: null })));
      nav.pathname = "/";
      render(<AuthGate>home</AuthGate>);
      await screen.findByText("home");

      hide();
      await waitFor(() => expect(trackCalls()).toHaveLength(1));
      const { events } = JSON.parse(String(trackCalls()[0][1]?.body)) as { events: { kind: string }[] };
      expect(events.map((e) => e.kind)).toEqual(["signin"]);
    });
  });

  it("always renders the callback route, even signed out", async () => {
    signedOut();
    nav.pathname = "/auth/callback/";
    render(
      <AuthGate>
        <AuthCallbackPage />
      </AuthGate>,
    );

    expect(screen.getByRole("status").textContent).toMatch(/signing you in/i);
    expect(document.querySelector("main .brand-loader svg")).not.toBeNull();
    expect(document.querySelector('main img[src*="robot-head.png"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
  });

  it("renders the privacy policy signed out, with no sign-in in the way", async () => {
    signedOut();
    nav.pathname = "/privacy/";
    render(
      <AuthGate>
        <PrivacyPage />
      </AuthGate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull());
  });
});
