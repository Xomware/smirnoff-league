import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import Home from "./page";

beforeEach(stubSleeper);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("embeds the draft recap from youtube-nocookie, lazily", () => {
    render(<Home />);

    const player = screen.getByTitle(/draft recap/i);
    expect(player.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/6h-B_O-r7jg");
    expect(player.getAttribute("loading")).toBe("lazy");
  });

  it("shows the season's owed ices in This week", async () => {
    render(<Home />);

    const owed = await screen.findByText("Season owed (provisional)");
    expect(owed.nextElementSibling?.textContent).toBe("8");
  });
});
