import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { IceBadge } from "./IceBadge";
import { PlayerRow } from "./PlayerRow";
import { Taskbar } from "./Taskbar";
import { TeamName } from "./TeamName";

describe("IceBadge", () => {
  it("renders nothing at 0", () => {
    const { container } = render(<IceBadge count={0} />);
    expect(container.innerHTML).toBe("");
  });

  it.each([1, 3])("renders x%i", (n) => {
    render(<IceBadge count={n} />);
    expect(screen.getByText(`x${n}`)).toBeTruthy();
  });
});

describe("ice variant", () => {
  it("frosts the team name and avatar when iced", () => {
    const { container } = render(<TeamName name="Team A" iced ices={1} />);
    expect(screen.getByText("Team A").classList).toContain("ice");
    expect(container.querySelector(".xp-avatar")?.classList).toContain("ice");
  });

  it("leaves an un-iced team name alone", () => {
    const { container } = render(<TeamName name="Team B" iced={false} ices={0} />);
    expect(screen.getByText("Team B").classList).not.toContain("ice");
    expect(container.querySelector(".xp-avatar")?.classList).not.toContain("ice");
  });

  it("frosts the player row when iced", () => {
    render(
      <ul>
        <PlayerRow name="Player One" position="WR" points={0} iced ices={1} />
      </ul>,
    );
    expect(screen.getByRole("listitem").classList).toContain("ice");
  });
});

const renderTaskbar = () =>
  render(
    <DesktopProvider>
      <Taskbar />
    </DesktopProvider>,
  );

describe("Start menu", () => {
  // Taskbar tabs read the league for window titles.
  beforeEach(stubSleeper);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens from Start, and its items open windows on the desktop", () => {
    renderTaskbar();
    const start = screen.getByRole("button", { name: /start/i });
    expect(screen.queryByRole("link", { name: "Brackets" })).toBeNull();

    fireEvent.click(start);
    expect(start.getAttribute("aria-expanded")).toBe("true");
    const brackets = screen.getByRole("link", { name: "Brackets" });
    expect(brackets.getAttribute("href")).toBe("/");

    fireEvent.click(brackets);

    expect(start.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Brackets" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers sign out", () => {
    renderTaskbar();
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("closes on Escape and returns focus to Start", () => {
    renderTaskbar();
    const start = screen.getByRole("button", { name: /start/i });
    fireEvent.click(start);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("link", { name: "Standings" })).toBeNull();
    expect(start.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(start);
  });
});
