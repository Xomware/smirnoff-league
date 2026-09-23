import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandLoader } from "./BrandLoader";

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => reducedMotion(false));

describe("BrandLoader", () => {
  it.each(["xp", "glacier"] as const)("announces its label as a status in the %s theme", (theme) => {
    const { container } = render(<BrandLoader label="Signing you in..." theme={theme} />);

    expect(screen.getByRole("status").textContent).toBe("Signing you in...");
    expect(container.querySelector(".brand-loader svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks itself glacier only when asked, so an ancestor theme can still restyle it", () => {
    const { container, rerender } = render(<BrandLoader label="Loading" />);
    expect(container.querySelector(".brand-loader")?.hasAttribute("data-theme")).toBe(false);

    rerender(<BrandLoader label="Loading" theme="glacier" />);
    expect(container.querySelector(".brand-loader")?.getAttribute("data-theme")).toBe("glacier");
  });

  it("swings the arms when motion is allowed", () => {
    const { container } = render(<BrandLoader label="Loading" />);

    expect(container.querySelector(".brand-loader-cheer")).not.toBeNull();
    expect(container.querySelector(".brand-loader-still")).toBeNull();
  });

  it("holds the clinked pose with no swing under reduced motion", () => {
    reducedMotion(true);
    const { container } = render(<BrandLoader label="Loading" />);

    expect(container.querySelector(".brand-loader-cheer")).toBeNull();
    expect(container.querySelector(".brand-loader-still")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading");
  });
});
