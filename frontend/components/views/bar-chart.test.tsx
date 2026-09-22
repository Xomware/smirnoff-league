import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { iceStats } from "@/lib/ices/stats";
import { golden, W1_POSITIONS } from "@/lib/test/league-mock";
import { BarChart } from "./bar-chart";

const stats = iceStats(golden.weeks, (id) => W1_POSITIONS[id]);

describe("BarChart", () => {
  it("draws one bar, one axis label and one value per week from the stats", () => {
    const bars = stats.byWeek.map(({ week, count }) => ({ label: `W${week}`, value: count }));
    const { container } = render(<BarChart title="Ices by week" bars={bars} />);

    const chart = screen.getByRole("img", { name: /ices by week/i });
    expect(chart.getAttribute("aria-label")).toBe("Ices by week: W1 5, W2 3");
    expect(container.querySelectorAll("rect.stats-bar")).toHaveLength(2);
    expect([...container.querySelectorAll(".stats-label")].map((t) => t.textContent)).toEqual(["W1", "W2"]);
    expect([...container.querySelectorAll(".stats-value")].map((t) => t.textContent)).toEqual(["5", "3"]);
    expect([...container.querySelectorAll("title")].map((t) => t.textContent)).toEqual(["W1: 5 ices", "W2: 3 ices"]);
  });

  it("lays teams out as horizontal bars with their names", () => {
    const bars = stats.byTeam.map(({ rosterId, count }) => ({ label: `Team ${rosterId}`, value: count }));
    const { container } = render(<BarChart title="Ices by team" bars={bars} horizontal />);

    const rects = container.querySelectorAll("rect.stats-bar");
    expect(rects).toHaveLength(5);
    expect(Number(rects[0].getAttribute("width"))).toBeGreaterThan(Number(rects[3].getAttribute("width")));
    expect([...container.querySelectorAll(".stats-label")].map((t) => t.textContent)).toEqual([
      "Team 6",
      "Team 12",
      "Team 13",
      "Team 2",
      "Team 8",
    ]);
  });

  it("says so in plain text when there is nothing to draw", () => {
    render(<BarChart title="Ices by week" bars={[{ label: "Empty", value: 0 }]} empty="Nothing yet." />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
  });
});
