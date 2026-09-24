import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { THEME_KEY, THEME_SCRIPT } from "@/lib/theme/theme";
import { PHONE } from "@/lib/use-media-query";
import { BrandLoader } from "./BrandLoader";

const media = ({ reduced = false, phone = false }) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: (reduced && query.includes("reduced-motion")) || (phone && query === PHONE),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const css = document.createElement("style");
css.textContent = readFileSync(`${import.meta.dirname}/brand-loader.css`, "utf8");
document.head.append(css);

// The Glacier label is a pill, the XP one a note.
const loaderTheme = () =>
  getComputedStyle(screen.getByRole("status")).borderRadius === "999px" ? "glacier" : "xp";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => media({}));

describe("BrandLoader", () => {
  it("announces its label as a status and hides the art", () => {
    const { container } = render(<BrandLoader label="Signing you in..." />);

    expect(screen.getByRole("status").textContent).toBe("Signing you in...");
    expect(container.querySelector(".brand-loader svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["a stored Glacier choice", "glacier", false, "glacier"],
    ["a phone with nothing stored", null, true, "glacier"],
    ["a stored XP choice on a phone", "xp", true, "xp"],
    ["a desktop with nothing stored", null, false, "xp"],
  ])("takes the theme the pre-hydration script picks for %s", (_, stored, phone, want) => {
    media({ phone });
    if (stored) localStorage.setItem(THEME_KEY, stored);
    new Function(THEME_SCRIPT)();
    render(<BrandLoader label="Loading" />);

    expect(loaderTheme()).toBe(want);
  });

  it("holds each bottle as the Smirnoff Ice bottle art", () => {
    const { container } = render(<BrandLoader label="Loading" />);
    const bottles = [...container.querySelectorAll("svg image")].map((i) => i.getAttribute("href"));

    expect(bottles).toEqual(["/brand/ice-bottle-256.png", "/brand/ice-bottle-256.png"]);
  });

  it("swings the arms when motion is allowed", () => {
    const { container } = render(<BrandLoader label="Loading" />);

    expect(container.querySelector(".brand-loader-cheer")).not.toBeNull();
    expect(container.querySelector(".brand-loader-still")).toBeNull();
  });

  it("holds the clinked pose with no swing under reduced motion", () => {
    media({ reduced: true });
    const { container } = render(<BrandLoader label="Loading" />);

    expect(container.querySelector(".brand-loader-cheer")).toBeNull();
    expect(container.querySelector(".brand-loader-still")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading");
  });
});
