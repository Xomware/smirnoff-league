import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("Start menu", () => {
  it("opens from Start and lists nav links", () => {
    render(<Taskbar />);
    const start = screen.getByRole("button", { name: /start/i });
    expect(screen.queryByRole("link", { name: "Standings" })).toBeNull();

    fireEvent.click(start);

    expect(start.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Standings" }).getAttribute("href")).toBe("/standings");
  });

  it("offers sign out", () => {
    render(<Taskbar />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("closes on Escape and returns focus to Start", () => {
    render(<Taskbar />);
    const start = screen.getByRole("button", { name: /start/i });
    fireEvent.click(start);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("link", { name: "Standings" })).toBeNull();
    expect(start.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(start);
  });
});
