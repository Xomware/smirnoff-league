import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { iceStats } from "@/lib/ices/stats";
import { golden, W1_POSITIONS } from "@/lib/test/league-mock";
import { DrillContext } from "./drill-link";
import { HallOfShame } from "./hall-of-shame";

const stats = iceStats(golden.weeks, (id) => W1_POSITIONS[id]);
const names = { teamName: (id: number) => `Team ${id}`, playerName: (id: string) => `Player ${id}` };
const card = (name: string) => screen.getByRole("region", { name });
const items = (name: string) => within(card(name)).getAllByRole("listitem").map((li) => li.textContent);

describe("Hall of Shame on the golden W1/W2 weeks", () => {
  it("leads Avoidable Ices with the 23.7 roster 2 left on the bench", () => {
    render(<HallOfShame stats={stats} {...names} />);

    const rows = items("Avoidable Ices");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("Left 23.7 on the bench and chugged anyway");
    expect(rows[0]).toContain("Team 2");
    expect(rows[0]).toContain("Player 7553");
    expect(rows[0]).toContain("Player 5022");
    expect(rows[1]).toContain("Left 9.2");
    expect(rows[2]).toContain("Left 3.1");
  });

  it("lists the closest escapes, lowest first", () => {
    render(<HallOfShame stats={stats} {...names} />);
    const rows = items("Closest Escapes");
    expect(rows).toHaveLength(8);
    expect(rows[0]).toContain("Player 12508");
    expect(rows[0]).toContain("0.8");
    expect(rows[0]).toContain("Team 13");
  });

  it("shows streaks, lowest-score magnets and the empty cards", () => {
    render(<HallOfShame stats={stats} {...names} />);

    expect(items("Ice Streaks")[0]).toMatch(/Team 12.*2 weeks/);
    expect(items("Lowest-Score Magnets")).toEqual([expect.stringContaining("Team 6"), expect.stringContaining("Team 13")]);
    expect(within(card("Most Wanted")).getByText(/no repeat offenders/i)).toBeTruthy();
    expect(within(card("Lazy Manager")).getByText(/every slot filled/i)).toBeTruthy();
  });

  it("puts a repeat offender on a wanted poster with the teams that started him", () => {
    const offenders = [{ playerId: "8121", count: 2, weeks: [1, 2], rosterIds: [6, 9] }];
    render(<HallOfShame stats={{ ...stats, repeatOffenders: offenders }} {...names} />);

    const poster = within(card("Most Wanted")).getByRole("listitem");
    expect(poster.textContent).toContain("Player 8121");
    expect(poster.textContent).toContain("caused 2 ices");
    expect(poster.textContent).toContain("Team 6, Team 9");
  });

  it("drills into the team and players named in a row", () => {
    const onOpen = vi.fn();
    render(
      <DrillContext.Provider value={onOpen}>
        <HallOfShame stats={stats} {...names} />
      </DrillContext.Provider>,
    );
    const row = within(card("Avoidable Ices")).getAllByRole("listitem")[0];

    fireEvent.click(within(row).getByRole("button", { name: "Team 2" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "team", rosterId: 2 });
    fireEvent.click(within(row).getByRole("button", { name: "Player 5022" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "player", playerId: "5022" });
  });
});
