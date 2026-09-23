import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Effects } from "./Effects";

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => {
  vi.useRealTimers();
  reducedMotion(false);
});

describe("Glacier effects", () => {
  it("renders the same seeded snowflakes every time", () => {
    const first = render(<Effects />).container.innerHTML;
    expect(document.querySelectorAll(".glacier-flake")).toHaveLength(70);
    const again = render(<Effects />).container.innerHTML;
    expect(again).toBe(first);
  });

  it("throws a snowball at the click point and clears it after the splat", () => {
    vi.useFakeTimers();
    render(<Effects />);
    fireEvent.click(document.body, { clientX: 200, clientY: 150 });

    const ball = document.querySelector<HTMLElement>(".glacier-ball");
    expect(ball).not.toBeNull();
    expect([ball!.style.left, ball!.style.top]).toEqual(["200px", "150px"]);
    expect(document.querySelectorAll(".glacier-splat")).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1299));
    expect(document.querySelector(".glacier-ball")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector(".glacier-ball")).toBeNull();
    expect(document.querySelector(".glacier-splat")).toBeNull();
  });

  it("ignores clicks on controls", () => {
    render(
      <>
        <Effects />
        <button type="button">
          <span>Save</span>
        </button>
        <div data-no-snowball>
          <p>Board</p>
        </div>
      </>,
    );
    fireEvent.click(screen.getByText("Save"), { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByText("Board"), { clientX: 10, clientY: 10 });
    expect(document.querySelector(".glacier-ball")).toBeNull();
  });

  it("trails the cursor on pointer devices only", () => {
    render(<Effects />);
    fireEvent.pointerMove(window, { clientX: 40, clientY: 60 });
    expect(document.querySelectorAll(".glacier-trail")).toHaveLength(0);

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: fine)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Effects />);
    fireEvent.pointerMove(window, { clientX: 40, clientY: 60 });
    expect(document.querySelectorAll(".glacier-trail")).toHaveLength(5);
  });

  it("renders nothing and throws nothing under reduced motion", () => {
    reducedMotion(true);
    const { container } = render(<Effects />);
    expect(container.innerHTML).toBe("");
    fireEvent.click(document.body, { clientX: 200, clientY: 150 });
    expect(document.querySelector(".glacier-ball")).toBeNull();
  });
});
