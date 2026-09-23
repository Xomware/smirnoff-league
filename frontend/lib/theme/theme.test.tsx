import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getMe, type Profile, updateMe } from "@/lib/api/users";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { THEME_KEY, ThemeProvider } from "./theme";

const profile = (theme?: Profile["theme"]): Profile => ({
  name: "Me",
  username: "me",
  rosterId: 1,
  theme,
  createdAt: "",
  updatedAt: "",
});

const signedIn = (theme?: Profile["theme"]) =>
  vi.mocked(getMe).mockResolvedValue({ sub: "s", email: "e", isAdmin: false, profile: profile(theme) });

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");
const htmlTheme = () => document.documentElement.dataset.theme;

function renderSignedOut() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

function renderSignedIn() {
  render(
    <ProfileProvider>
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("theme, signed out", () => {
  it("defaults to Classic XP and marks <html>", () => {
    renderSignedOut();
    expect(pressed("Classic XP")).toBe("true");
    expect(pressed("Glacier")).toBe("false");
    expect(htmlTheme()).toBe("xp");
  });

  it("switches and persists the choice to localStorage only", () => {
    renderSignedOut();
    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));

    expect(pressed("Glacier")).toBe("true");
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
    expect(htmlTheme()).toBe("glacier");
    expect(updateMe).not.toHaveBeenCalled();
  });

  it("starts from the stored choice", () => {
    localStorage.setItem(THEME_KEY, "glacier");
    renderSignedOut();
    expect(pressed("Glacier")).toBe("true");
  });

  it("still switches when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    renderSignedOut();
    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));
    expect(pressed("Glacier")).toBe("true");
  });
});

describe("theme, signed in", () => {
  it("saves a switch to the profile", async () => {
    signedIn("xp");
    vi.mocked(updateMe).mockResolvedValue(profile("glacier"));
    renderSignedIn();
    // The profile's saved theme lands in storage once /me is back.
    await waitFor(() => expect(localStorage.getItem(THEME_KEY)).toBe("xp"));

    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));

    expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" });
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
  });

  it("rolls back when the save fails", async () => {
    signedIn("xp");
    vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
    renderSignedIn();
    // The profile's saved theme lands in storage once /me is back.
    await waitFor(() => expect(localStorage.getItem(THEME_KEY)).toBe("xp"));

    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));
    expect(pressed("Glacier")).toBe("true");

    await waitFor(() => expect(pressed("Classic XP")).toBe("true"));
    expect(localStorage.getItem(THEME_KEY)).toBe("xp");
    expect(htmlTheme()).toBe("xp");
  });

  it("takes the profile's theme over localStorage", async () => {
    localStorage.setItem(THEME_KEY, "xp");
    signedIn("glacier");
    renderSignedIn();

    await waitFor(() => expect(pressed("Glacier")).toBe("true"));
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
    expect(updateMe).not.toHaveBeenCalled();
  });

  it("saves the local choice to a profile that has none", async () => {
    localStorage.setItem(THEME_KEY, "glacier");
    signedIn(null);
    vi.mocked(updateMe).mockResolvedValue(profile("glacier"));
    renderSignedIn();

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" }));
    expect(pressed("Glacier")).toBe("true");
  });

  it("leaves a profile with no theme alone when nothing is stored", async () => {
    signedIn(null);
    renderSignedIn();
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(updateMe).not.toHaveBeenCalled();
  });
});
