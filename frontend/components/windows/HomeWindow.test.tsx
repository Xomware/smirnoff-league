import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { stubSleeper } from "@/lib/test/league-mock";
import { HomeWindow } from "./HomeWindow";

// Sleeper already says week 3; its Thursday game kicks off 8:15pm ET on Sep 24.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T16:00Z"));
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) =>
    String(input).includes("espn.com")
      ? jsonResponse({ events: [espnEvent({ home: "NYJ", away: "MIA", date: "2026-09-25T00:15Z" })] })
      : sleeper(input, init),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Home before Thursday night", () => {
  it("shows last week's ices, badged per team for that week", async () => {
    render(<HomeWindow />);

    const list = await screen.findByRole("list", { name: "Ices in week 2" });
    const badge = (team: string) => within(list).getByText(team).closest("li")?.querySelector(".ice-badge");
    expect(badge("Team 13")?.textContent).toContain("2 ices this week");
    expect(badge("Team 12")?.textContent).toContain("1 ice this week");
    expect(within(list).queryByText("Team 6")).toBeNull();
    expect(screen.getByText("Ices in week 2").nextElementSibling?.textContent).toBe("3");
  });
});

describe("Home is ice-first", () => {
  it("lists who owes and leaves the news feed to League News", async () => {
    render(<HomeWindow />);

    const owes = await screen.findByRole("list", { name: "Who owes" });
    expect(within(owes).getByText("Team 13")).toBeTruthy();
    expect(screen.queryByText("Latest news")).toBeNull();
    expect(screen.queryByRole("region", { name: /news/i })).toBeNull();
  });
});

describe("Home summary", () => {
  it("shows the league mascot", () => {
    render(<HomeWindow />);
    const mascot = screen.getByRole("img", { name: /robot chugging a smirnoff ice/i });
    expect(mascot.getAttribute("src")).toContain("mascot.png");
  });
});
