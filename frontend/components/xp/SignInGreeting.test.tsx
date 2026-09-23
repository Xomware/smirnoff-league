import { fireEvent, render, screen } from "@testing-library/react";
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
}));

import { AuthGate } from "@/components/auth/auth-gate";
import { getMe } from "@/lib/api/users";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubAudio } from "@/lib/test/audio-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { Taskbar } from "./Taskbar";

function signedInAs(rosterId: number) {
  vi.mocked(getMe).mockResolvedValue({
    sub: "u",
    email: "member@example.com",
    isAdmin: false,
    profile: { name: "Member", username: "member", rosterId, createdAt: "", updatedAt: "" },
  });
}

let audio: ReturnType<typeof stubAudio>;

beforeEach(() => {
  window.localStorage.clear();
  stubSleeper();
  audio = stubAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderSignedIn = () =>
  render(
    <DesktopProvider>
      <AuthGate>
        <p>home</p>
        <Taskbar />
      </AuthGate>
    </DesktopProvider>,
  );

describe("signing in", () => {
  // Golden week 3 has no games yet, so the report falls back to week 2's ices.
  it("shows an ice report balloon and plays the startup sound on the first click", async () => {
    signedInAs(1);
    renderSignedIn();

    const balloon = await screen.findByText(/2 teams iced in week 2/i);
    expect(balloon.closest("[role=status]")?.textContent).toMatch(/Team 12.*Team 13/);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(audio.notes).toBe(0);

    fireEvent.pointerDown(screen.getByText("home"));
    expect(audio.contexts).toBe(1);
    expect(audio.notes).toBeGreaterThan(0);
  });

  it("crashes ICE.EXE when your own starter put up a zero", async () => {
    signedInAs(12);
    renderSignedIn();

    const dialog = await screen.findByRole("alertdialog", { name: "ICE.EXE" });
    expect(dialog.textContent).toMatch(/has encountered a problem and needs to close/i);
  });

  it("leaves the report and the crash to Glacier's own toasts", async () => {
    window.localStorage.setItem("smirnoff.theme", "glacier");
    signedInAs(12);
    renderSignedIn();

    await screen.findByText("home");
    // The XP report lands within a few ticks of the league loading; give it room.
    await new Promise((done) => setTimeout(done, 500));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText(/teams? iced/i)).toBeNull();
  });

  it("toggles mute from the tray", async () => {
    signedInAs(1);
    renderSignedIn();

    // useSyncExternalStore subscribes in a passive effect, and findByRole can
    // resolve before it runs. A click then mutes with no listener, and the label
    // only catches up when the effect subscribes (the PR #95 CI flake).
    fireEvent.click(await screen.findByRole("button", { name: "Mute sounds" }));
    expect(await screen.findByRole("button", { name: "Unmute sounds" })).toBeTruthy();
    expect(window.localStorage.getItem("smirnoff:muted")).toBe("1");
  });
});
