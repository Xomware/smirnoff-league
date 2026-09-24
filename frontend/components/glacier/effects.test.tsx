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


describe("snowflakes", () => {
  const withCss = () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(`${import.meta.dirname}/effects.css`, "utf8");
    document.head.append(style);
    return style;
  };

  const flakes = () =>
    [...document.querySelectorAll<HTMLElement>(".glacier-flake")].map((el) => ({
      el,
      art: el.querySelector<SVGSVGElement>("svg")!,
      size: Number(el.querySelector("svg")!.getAttribute("width")),
      opacity: Number(el.style.opacity),
      fall: parseFloat(el.style.animationDuration),
    }));

  it("falls a limited number of flakes", () => {
    render(<Effects />);
    const count = flakes().length;
    expect(count).toBeGreaterThanOrEqual(60);
    expect(count).toBeLessThanOrEqual(80);
  });

  it("draws each flake as a six-armed crystal from a few shared shapes", () => {
    render(<Effects />);
    const used = new Set<string>();
    for (const { art } of flakes()) {
      const href = art.querySelector("use")!.getAttribute("href")!;
      used.add(href);
      const symbol = document.querySelector(`symbol${href}`);
      expect(symbol).not.toBeNull();
    }
    expect(used.size).toBeGreaterThanOrEqual(3);
    for (const symbol of document.querySelectorAll(".glacier-snow symbol")) {
      const d = symbol.querySelector("path")!.getAttribute("d")!;
      // Every stroke comes in six copies, one per arm.
      expect(d.match(/M/g)!.length % 6).toBe(0);
    }
  });

  it("mixes depths: small far flakes are dimmer, slower and more numerous", () => {
    render(<Effects />);
    const all = flakes();
    for (const f of all) {
      expect(f.size).toBeGreaterThanOrEqual(6);
      expect(f.size).toBeLessThanOrEqual(22);
    }
    const far = all.filter((f) => f.size < 10);
    const near = all.filter((f) => f.size >= 16);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(near.length * 2);
    expect(Math.max(...far.map((f) => f.opacity))).toBeLessThan(Math.min(...near.map((f) => f.opacity)));
    expect(mean(far.map((f) => f.fall))).toBeGreaterThan(mean(near.map((f) => f.fall)));
  });

  it("spins and sways each flake as it falls", () => {
    const style = withCss();
    render(<Effects />);
    const [first] = flakes();
    expect(getComputedStyle(first.el).animationName).toBe("glacier-fall");
    expect(getComputedStyle(first.art).animationName).toBe("glacier-flutter");
    expect(getComputedStyle(first.art).filter).toMatch(/^drop-shadow/);
    style.remove();
  });

  it("leaves cards and headings alone: no landers, no caps", () => {
    vi.useFakeTimers();
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <div className="gh-card" data-testid="card" />
        <h2>Ice Standings</h2>
      </div>,
    );
    act(() => vi.advanceTimersByTime(60_000));
    expect(document.querySelector(".glacier-lander, [data-snow]")).toBeNull();
    expect(screen.getByTestId("card").getAttribute("style")).toBeNull();
  });

  it("drops no snow under reduced motion", () => {
    reducedMotion(true);
    render(<Effects />);
    expect(document.querySelector(".glacier-snow, .glacier-flake")).toBeNull();
  });
});
