import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import { DrillContext } from "./drill-link";
import { PlayerView } from "./player-view";
import { TeamView } from "./team-view";
import { WeekView } from "./week-view";

beforeEach(stubSleeper);
afterEach(() => {
  vi.restoreAllMocks();
});

const withDrill = (onOpen: () => void, view: ReactNode) => (
  <DrillContext.Provider value={onOpen}>{view}</DrillContext.Provider>
);

describe("Team view", () => {
  it("shows roster 6's record, weekly results and ice total", async () => {
    render(<TeamView rosterId={6} />);

    const results = await screen.findByRole("table", { name: "Weekly results" });
    const [, w1, w2] = within(results).getAllByRole("row");
    expect(w1.textContent).toContain("Team 9");
    expect(w1.textContent).toContain("91.46");
    expect(within(w1).getAllByRole("cell")[3].textContent).toBe("L");
    expect(w2.textContent).toContain("Team 1");

    expect(screen.getByText("1-1")).toBeTruthy();
    expect(screen.getByText(/PF 194\.00/)).toBeTruthy();
    const total = screen.getByRole("list", { name: "Season ices by reason" });
    expect(total.textContent).toContain("Zero points: 1");
    expect(total.textContent).toContain("Lowest score: 1");
    expect(within(screen.getByRole("list", { name: "Starters, week 2" })).getAllByRole("listitem")).toHaveLength(10);
  });

  it("clicks through from a zeroed player to his Player view listing the W1 ice", async () => {
    const onOpen = vi.fn();
    const { unmount } = render(withDrill(onOpen, <TeamView rosterId={6} />));

    const results = await screen.findByRole("table", { name: "Weekly results" });
    fireEvent.click(within(results).getByRole("button", { name: "Week 1" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "week", week: 1 });
    fireEvent.click(within(results).getByRole("button", { name: /Romeo Doubs/ }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "player", playerId: "8121" });
    unmount();

    const { playerId } = onOpen.mock.lastCall![0];
    render(<PlayerView playerId={playerId} />);
    const ices = await screen.findByRole("table", { name: "Ices caused" });
    expect(within(ices).getByRole("button", { name: "Week 1" })).toBeTruthy();
  });
});

describe("Player view", () => {
  it("lists Romeo Doubs' W1 ice and his weekly points", async () => {
    render(<PlayerView playerId="8121" />);

    expect(await screen.findByRole("heading", { name: "Romeo Doubs" })).toBeTruthy();
    expect(screen.getByText("WR · GB")).toBeTruthy();
    const ices = await screen.findByRole("table", { name: "Ices caused" });
    const rows = within(ices).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Team 6");
    expect(rows[0].textContent).toContain("0.00");
    expect(within(screen.getByRole("table", { name: "Weekly points" })).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText(/repeat offender/i)).toBeNull();
  });
});

describe("Week view", () => {
  it("shows week 1 matchups, ices by team and the lowest score", async () => {
    const onOpen = vi.fn();
    render(withDrill(onOpen, <WeekView week={1} />));

    const matchups = await screen.findByRole("list", { name: "Matchups" });
    expect(within(matchups).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText(/lowest score of the week/i).closest("p")?.textContent).toContain("Team 6");
    expect(screen.getByRole("list", { name: "Team 6 ices" }).children).toHaveLength(2);

    fireEvent.click(within(matchups).getAllByRole("button", { name: /Team 9/ })[0]);
    expect(onOpen).toHaveBeenCalledWith({ kind: "team", rosterId: 9 });
  });

  it("says so when the live week has no matchups yet", async () => {
    render(<WeekView week={3} />);
    expect(await screen.findByText(/no matchups for week 3 yet/i)).toBeTruthy();
  });
});
