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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { AuthGate } from "@/components/auth/auth-gate";
import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import Home from "./page";

beforeEach(() => {
  stubSleeper();
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderSignedIn() {
  render(
    <DesktopProvider>
      <AuthGate shell={<Taskbar />}>
        <Home />
      </AuthGate>
    </DesktopProvider>,
  );
}

const tabs = () => within(screen.getByRole("list", { name: "Open windows" }));

describe("Home", () => {
  it("embeds the draft recap from youtube-nocookie, lazily", async () => {
    renderSignedIn();

    const player = await screen.findByTitle(/draft recap/i);
    expect(player.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/6h-B_O-r7jg");
    expect(player.getAttribute("loading")).toBe("lazy");
  });

  it("shows the season's owed ices in the league summary", async () => {
    renderSignedIn();

    const owed = await screen.findByText("Season owed (provisional)");
    expect(owed.nextElementSibling?.textContent).toBe("8");
  });

  it("opens the default desktop, then focuses, minimizes and restores Standings", async () => {
    renderSignedIn();

    for (const name of ["Smirnoff Fantasy Football League", "Now Playing - Draft Recap", "League Standings", "League News"]) {
      expect(await screen.findByRole("region", { name })).toBeTruthy();
    }
    const standingsTab = tabs().getByRole("button", { name: "League Standings" });
    expect(standingsTab.getAttribute("aria-pressed")).toBe("false");

    fireEvent.doubleClick(screen.getByRole("button", { name: "Standings" }));
    expect(standingsTab.getAttribute("aria-pressed")).toBe("true");
    expect(tabs().getAllByRole("button")).toHaveLength(4);

    const standings = screen.getByRole("region", { name: "League Standings" });
    const bar = within(standings).getByRole("heading", { name: "League Standings" }).parentElement!;
    const left = parseFloat(standings.style.left);
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 400, clientY: 50 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 380, clientY: 50 });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(parseFloat(standings.style.left)).toBe(left - 20);

    fireEvent.click(within(standings).getByRole("button", { name: "Minimize" }));
    expect(standings.hidden).toBe(true);

    fireEvent.click(standingsTab);
    expect(standings.hidden).toBe(false);
    expect(standingsTab.getAttribute("aria-pressed")).toBe("true");
  });

  it("opens a window from a desktop icon with Enter", async () => {
    renderSignedIn();

    fireEvent.keyDown(await screen.findByRole("button", { name: "Scores" }), { key: "Enter" });

    expect(await screen.findByRole("region", { name: "Scores" })).toBeTruthy();
    expect(tabs().getByRole("button", { name: "Scores" }).getAttribute("aria-pressed")).toBe("true");
  });
});
