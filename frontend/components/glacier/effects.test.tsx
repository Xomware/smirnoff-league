import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("snow caps", () => {
  let observers: { cb: IntersectionObserverCallback; observed: Set<Element>; disconnected: boolean }[] = [];

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry: (typeof observers)[number];
        constructor(cb: IntersectionObserverCallback) {
          this.entry = { cb, observed: new Set(), disconnected: false };
          observers.push(this.entry);
        }
        observe(el: Element) {
          this.entry.observed.add(el);
        }
        unobserve(el: Element) {
          this.entry.observed.delete(el);
        }
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance", "Date"] });
  });

  const cards = () => {
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <div data-snow-cap data-testid="seen" />
        <div data-snow-cap data-testid="offscreen" />
      </div>,
    );
    const seen = screen.getByTestId("seen");
    const offscreen = screen.getByTestId("offscreen");
    seen.getBoundingClientRect = () => new DOMRect(40, 400, 300, 120);
    offscreen.getBoundingClientRect = () => new DOMRect(40, 1400, 300, 120);
    return { seen, offscreen };
  };

  const show = (...els: Element[]) =>
    act(() => {
      const io = observers.at(-1)!;
      io.cb(
        els.map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
    });

  const cap = (el: HTMLElement) => parseFloat(el.style.getPropertyValue("--snow-cap") || "0");

  it("drops landers into the snow layer, behind the page", () => {
    render(<Effects />);
    const landers = document.querySelectorAll(".glacier-lander");
    expect(landers.length).toBeGreaterThan(0);
    expect(landers.length).toBeLessThanOrEqual(6);
    for (const l of landers) expect(l.closest(".glacier-snow")).not.toBeNull();
  });

  it("builds a cap on a visible card as landers land, up to a small max", () => {
    const { seen } = cards();
    show(seen);
    expect(cap(seen)).toBe(0);
    act(() => vi.advanceTimersByTime(30_000));
    const early = cap(seen);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(10);
    act(() => vi.advanceTimersByTime(600_000));
    expect(cap(seen)).toBe(10);
  });

  it("only sends landers to cards in the viewport", () => {
    const { seen, offscreen } = cards();
    expect([...observers.at(-1)!.observed]).toEqual(expect.arrayContaining([seen, offscreen]));
    show(seen);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBeGreaterThan(0);
    expect(cap(offscreen)).toBe(0);
  });

  it("clears the caps when the page changes", () => {
    const { seen } = cards();
    show(seen);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBeGreaterThan(0);
    act(() => {
      window.history.pushState(null, "", "/?open=ices");
      vi.advanceTimersByTime(3_000);
    });
    expect(cap(seen)).toBeLessThan(2);
    window.history.pushState(null, "", "/");
  });

  it("shows a small static cap and no falling snow under reduced motion", () => {
    reducedMotion(true);
    const { seen, offscreen } = cards();
    show(seen);
    act(() => vi.advanceTimersByTime(2_000));
    expect(document.querySelector(".glacier-flake, .glacier-lander")).toBeNull();
    const still = cap(seen);
    expect(still).toBeGreaterThan(0);
    expect(still).toBeLessThan(10);
    act(() => vi.advanceTimersByTime(120_000));
    expect(cap(seen)).toBe(still);
    expect(cap(offscreen)).toBe(0);
  });

  it("stops watching when unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { seen } = cards();
    show(seen);
    cleanup();
    expect(observers.at(-1)!.disconnected).toBe(true);
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["scroll", "resize"]));
    const before = cap(seen);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
