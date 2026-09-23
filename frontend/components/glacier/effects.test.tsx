import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { XpCursor } from "@/components/desktop/XpCursor";
import { Effects } from "./Effects";

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const finePointer = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: fine)",
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

  it("draws no cursor trail", () => {
    finePointer();
    render(<Effects />);
    fireEvent.pointerMove(window, { clientX: 40, clientY: 60 });
    expect(document.querySelector(".glacier-trail")).toBeNull();
  });

  it("keeps the snow in its own layer behind the page, under the snowballs", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(`${import.meta.dirname}/effects.css`, "utf8");
    document.head.append(style);
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <main>Standings</main>
      </div>,
    );
    fireEvent.click(document.body, { clientX: 200, clientY: 150 });

    const snow = document.querySelector(".glacier-snow")!;
    const above = document.querySelector(".glacier-effects")!;
    expect(above.contains(snow)).toBe(false);
    expect(above.querySelector(".glacier-ball")).not.toBeNull();
    expect(getComputedStyle(snow).position).toBe("fixed");
    expect(getComputedStyle(snow).zIndex).toBe("-1");
    // Without its own stacking context the root's background would paint over the snow.
    expect(getComputedStyle(document.querySelector(".glacier")!).zIndex).toBe("0");
    expect(Number(getComputedStyle(above).zIndex)).toBeGreaterThan(0);
    expect(getComputedStyle(above).pointerEvents).toBe("none");
    style.remove();
  });

  it("puts the bottle cursor on the page only while Glacier is mounted", () => {
    const { unmount } = render(<Effects />);
    expect(document.body).toHaveProperty("className", "glacier-cursor");
    unmount();
    expect(document.body.className).toBe("");

    render(<XpCursor />);
    expect(document.body.classList.contains("glacier-cursor")).toBe(false);
  });

  it("keeps the bottle cursor under reduced motion", () => {
    reducedMotion(true);
    render(<Effects />);
    expect(document.body.classList.contains("glacier-cursor")).toBe(true);
  });

  it("wobbles headings and nav links under a mouse, not body text", () => {
    render(
      <>
        <Effects />
        <h2>Ice Standings</h2>
        <nav aria-label="Main">
          <a href="#ices">Ices</a>
        </nav>
        <p>Paid in full</p>
        <table>
          <tbody>
            <tr>
              <td>12.4</td>
            </tr>
          </tbody>
        </table>
      </>,
    );
    const heading = screen.getByRole("heading", { name: "Ice Standings" });
    fireEvent.pointerOver(heading, { pointerType: "mouse" });
    fireEvent.pointerOver(screen.getByRole("link", { name: "Ices" }), { pointerType: "mouse" });
    fireEvent.pointerOver(screen.getByText("Paid in full"), { pointerType: "mouse" });
    fireEvent.pointerOver(screen.getByText("12.4"), { pointerType: "mouse" });

    expect(heading.dataset.wobble).toBeDefined();
    expect(screen.getByRole("link", { name: "Ices" }).dataset.wobble).toBeDefined();
    expect(document.querySelectorAll("[data-wobble]")).toHaveLength(2);
    expect(heading.innerHTML).toBe("Ice Standings");

    // jsdom has no AnimationEvent, so fireEvent would drop the animation name.
    fireEvent(heading, Object.assign(new Event("animationend", { bubbles: true }), { animationName: "glacier-wobble" }));
    expect(heading.dataset.wobble).toBeUndefined();
  });

  it("does not wobble under a finger", () => {
    render(
      <>
        <Effects />
        <h2>Ice Standings</h2>
      </>,
    );
    fireEvent.pointerOver(screen.getByRole("heading"), { pointerType: "touch" });
    expect(document.querySelector("[data-wobble]")).toBeNull();
  });

  it("renders nothing and throws nothing under reduced motion", () => {
    reducedMotion(true);
    const { container } = render(<Effects />);
    expect(container.innerHTML).toBe("");
    fireEvent.click(document.body, { clientX: 200, clientY: 150 });
    expect(document.querySelector(".glacier-ball")).toBeNull();
  });

  it("does not wobble under reduced motion", () => {
    reducedMotion(true);
    render(
      <>
        <Effects />
        <h2>Ice Standings</h2>
      </>,
    );
    fireEvent.pointerOver(screen.getByRole("heading"), { pointerType: "mouse" });
    expect(document.querySelector("[data-wobble]")).toBeNull();
  });
});
