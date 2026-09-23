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
import { PHONE } from "@/lib/use-media-query";
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

// Under reduced motion the switch goes through runThemeTransition but applies at
// once, since jsdom has no View Transitions; without it every switch waits 1.2s.
const media = ({ reduced = true, phone = false }) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: (reduced && query.includes("reduced-motion")) || (phone && query === PHONE),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

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
  return render(
    <ProfileProvider>
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  media({});
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  media({ reduced: false });
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

  it("covers the swap with the transition overlay when motion is allowed", async () => {
    media({ reduced: false });
    renderSignedOut();
    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));

    expect(document.querySelector(".theme-transition.tt-to-glacier")).not.toBeNull();
    expect(pressed("Classic XP")).toBe("true");
    expect(screen.getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await waitFor(() => expect(pressed("Glacier")).toBe("true"));
    await waitFor(() => expect(document.querySelector(".theme-transition")).toBeNull());
    expect(screen.getAllByRole("button").some((b) => (b as HTMLButtonElement).disabled)).toBe(false);
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

describe("device default", () => {
  it("is Glacier on a phone, and stays unstored until the user picks", () => {
    media({ phone: true });
    renderSignedOut();
    expect(pressed("Glacier")).toBe("true");
    expect(htmlTheme()).toBe("glacier");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Classic XP" }));
    expect(pressed("Classic XP")).toBe("true");
    expect(localStorage.getItem(THEME_KEY)).toBe("xp");
  });

  it("gives way to a stored choice on a phone", () => {
    media({ phone: true });
    localStorage.setItem(THEME_KEY, "xp");
    renderSignedOut();
    expect(pressed("Classic XP")).toBe("true");
  });

  it("is never written to a profile that has no theme", async () => {
    media({ phone: true });
    signedIn(null);
    renderSignedIn();
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(pressed("Glacier")).toBe("true");
    expect(updateMe).not.toHaveBeenCalled();
  });

  it("keeps a switch away from the device default when the save fails", async () => {
    media({ phone: true });
    signedIn(null);
    vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
    renderSignedIn();
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByRole("button", { name: "Classic XP" }));
    expect(updateMe).toHaveBeenCalledWith({ theme: "xp" });
    await waitFor(() => expect(pressed("Classic XP")).toBe("true"));
    expect(localStorage.getItem(THEME_KEY)).toBe("xp");
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

  it("keeps the choice when the save fails", async () => {
    signedIn("xp");
    vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
    renderSignedIn();
    // The profile's saved theme lands in storage once /me is back.
    await waitFor(() => expect(localStorage.getItem(THEME_KEY)).toBe("xp"));

    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));
    expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" });

    await waitFor(() => expect(pressed("Glacier")).toBe("true"));
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
    expect(htmlTheme()).toBe("glacier");
  });

  it("retries an unsaved choice on the next load instead of taking the stale profile theme", async () => {
    signedIn("xp");
    vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
    const first = renderSignedIn();
    await waitFor(() => expect(localStorage.getItem(THEME_KEY)).toBe("xp"));
    fireEvent.click(screen.getByRole("button", { name: "Glacier" }));
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" }));
    first.unmount();

    vi.mocked(updateMe).mockClear();
    vi.mocked(updateMe).mockResolvedValue(profile("glacier"));
    renderSignedIn();

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ theme: "glacier" }));
    expect(pressed("Glacier")).toBe("true");
    expect(localStorage.getItem(THEME_KEY)).toBe("glacier");
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
