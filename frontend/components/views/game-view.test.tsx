import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Desktop } from "@/components/desktop/Desktop";
import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { DrillContext } from "./drill-link";
import { GameView } from "./game-view";

beforeEach(() => {
  stubSleeper();
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const rows = (table: HTMLElement) => within(table).getAllByRole("row").slice(1);

// Golden W1 matchup 7: Team 6 (lowest score, and Romeo Doubs zeroed at WR) against Team 9.
describe("Game view", () => {
  it("lines both teams up by slot with the bench, what it left behind and each team's ices", async () => {
    const onOpen = vi.fn();
    render(
      <DrillContext.Provider value={onOpen}>
        <GameView week={1} matchup={7} />
      </DrillContext.Provider>,
    );

    const score = await screen.findByRole("region", { name: "Score" });
    expect(within(score).getByText("91.46")).toBeTruthy();
    expect(within(score).getByText("134.46")).toBeTruthy();
    expect(within(score).getByText("Final")).toBeTruthy();

    const lineups = screen.getByRole("table", { name: "Lineups" });
    expect(within(lineups).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Team 6", "Pts", "Slot", "Pts", "Team 9"]);
    expect(rows(lineups)).toHaveLength(10);
    const wr = rows(lineups)[4];
    expect(within(wr).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Romeo Doubs", "0.00", "WR", "9.50", "12519"]);
    expect(within(wr).getAllByRole("cell")[0].className).toContain("ice");

    const bench = screen.getByRole("table", { name: "Bench" });
    expect(within(bench).getByText("Player 4147")).toBeTruthy();
    const left = within(bench).getByRole("row", { name: /Left on bench/ });
    expect(within(left).getAllByRole("cell").map((c) => c.textContent)).toEqual(["8.00", "0.00"]);

    const ices = within(screen.getByRole("list", { name: "Team 6 ices" }));
    expect(ices.getByText("Lowest score")).toBeTruthy();
    expect(ices.getByText("Romeo Doubs")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Team 9 ices" })).toBeNull();

    fireEvent.click(within(score).getByText("Team 9").closest("button")!);
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "team", rosterId: 9 });
    fireEvent.click(within(wr).getByRole("button", { name: "Romeo Doubs" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "player", playerId: "8121" });
  });

  it("says so for a matchup the week does not have", async () => {
    render(<GameView week={1} matchup={99} />);
    expect(await screen.findByText("No such game in week 1.")).toBeTruthy();
  });
});

describe("scenario: Scores to a game and back", () => {
  it("opens a W1 matchup in place with both lineups and its ices, and Back returns to Scores", async () => {
    window.history.replaceState(null, "", "/?open=scores");
    render(
      <DesktopProvider>
        <Desktop />
        <Taskbar />
      </DesktopProvider>,
    );
    const win = document.querySelector<HTMLElement>('section[aria-label="Scores"]')!;
    fireEvent.change(await within(win).findByLabelText("Week"), { target: { value: "1" } });
    const card = await within(win).findByRole("region", { name: "Matchup 7" });

    fireEvent.click(within(card).getByRole("button", { name: "Open game" }));

    await waitFor(() => expect(win.getAttribute("aria-label")).toBe("Week 1: Team 6 vs Team 9"));
    expect(window.location.search).toBe("?open=game:1-7");
    const lineups = await within(win).findByRole("table", { name: "Lineups" });
    expect(rows(lineups)).toHaveLength(10);
    expect(within(win).getByRole("list", { name: "Team 6 ices" }).textContent).toContain("Lowest score");

    fireEvent.click(within(win).getByRole("button", { name: "Back" }));
    expect(win.getAttribute("aria-label")).toBe("Scores");
    expect(await within(win).findByLabelText("Week")).toBeTruthy();
  });
});
