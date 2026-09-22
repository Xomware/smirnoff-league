import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import StandingsPage from "./page";

beforeEach(stubSleeper);
afterEach(() => {
  vi.restoreAllMocks();
});

const badgeOf = (team: string) => screen.getByText(team).closest(".xp-team")?.querySelector(".ice-badge");

describe("Standings", () => {
  it("frosts the teams that owe W1/W2 ices", async () => {
    render(<StandingsPage />);

    await waitFor(() => expect(badgeOf("Team 13")?.textContent).toContain("x2"));
    expect(badgeOf("Team 2")?.textContent).toContain("x1");
    expect(badgeOf("Team 1")).toBeFalsy();
  });
});
