import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/standings/" }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import { AuthGate } from "@/components/auth/auth-gate";
import { StandingsWindow } from "@/components/windows/StandingsWindow";
import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { getMe, updateMe, type Me } from "@/lib/api/users";
import { stubSleeper } from "./league-stub";

const PROFILE = {
  name: "Player One",
  username: "player.one",
  rosterId: 6,
  createdAt: "2026-09-22T12:00:00+00:00",
  updatedAt: "2026-09-22T12:00:00+00:00",
};
const NEW_USER: Me = { sub: "abc", email: "player@example.com", profile: null, isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: { idToken: { payload: { email: "player@example.com" } } },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>);
  stubSleeper();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("first sign-in", () => {
  it("walks the wizard, then Standings marks the claimed roster as your team", async () => {
    vi.mocked(getMe)
      .mockResolvedValueOnce(NEW_USER)
      .mockResolvedValue({ ...NEW_USER, profile: PROFILE });
    vi.mocked(updateMe).mockResolvedValue(PROFILE);

    render(
      <DesktopProvider>
        <AuthGate shell={<Taskbar />}>
          <StandingsWindow />
        </AuthGate>
      </DesktopProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Your name" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Player One" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player.one" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(await screen.findByRole("radio", { name: /Team 6\b/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const table = await screen.findByRole("table");
    expect(updateMe).toHaveBeenCalledWith({ name: "Player One", username: "player.one", rosterId: 6 });

    const mine = within(table).getAllByRole("img", { name: "Your team" });
    expect(mine).toHaveLength(1);
    expect(within(mine[0].closest("tr")!).getByText("Team 6")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    fireEvent.click(screen.getByRole("button", { name: "My Profile" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Player One"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});
