import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { XpCursor } from "@/components/desktop/XpCursor";
import { Effects } from "./Effects";
import { driftHeights } from "./use-snow-caps";

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
    expect(document.querySelectorAll(".glacier-flake")).toHaveLength(105);
    const again = render(<Effects />).container.innerHTML;
    expect(again).toBe(first);
  });

  it("falls heavier, with small dim slow flakes far off and a few big bright fast ones near", () => {
    render(<Effects />);
    const flakes = [...document.querySelectorAll<HTMLElement>(".glacier-flake")].map((f) => ({
      size: parseFloat(f.style.width),
      opacity: parseFloat(f.style.opacity),
      secs: parseFloat(f.style.animationDuration),
    }));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // #242 averaged 4.5px.
    expect(mean(flakes.map((f) => f.size))).toBeGreaterThan(4.6);
    const bySize = [...flakes].sort((a, b) => a.size - b.size);
    const far = bySize.slice(0, 30);
    const near = bySize.slice(-8);
    expect(mean(near.map((f) => f.opacity))).toBeGreaterThan(mean(far.map((f) => f.opacity)) + 0.3);
    expect(Math.max(...near.map((f) => f.secs))).toBeLessThan(Math.min(...far.map((f) => f.secs)));
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
    // jsdom has no layout, so a heading's text sits 20px in and runs 160px.
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const r = (this.startContainer as Element).getBoundingClientRect();
      return new DOMRect(r.left + 20, r.top, 160, r.height);
    };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance", "Date"] });
  });

  afterEach(() => {
    delete (Range.prototype as Partial<Range>).getBoundingClientRect;
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  const place = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
    el.getBoundingClientRect = () => new DOMRect(x, y, w, h);
  };

  const cards = () => {
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <div data-snow-cap data-testid="seen">
          Standings
        </div>
        <div data-snow-cap data-testid="offscreen">
          Ledger
        </div>
      </div>,
    );
    const seen = screen.getByTestId("seen");
    const offscreen = screen.getByTestId("offscreen");
    place(seen, 40, 400, 300, 120);
    place(offscreen, 40, 1400, 300, 120);
    return { seen, offscreen };
  };

  const show = (...els: Element[]) =>
    act(() => {
      const io = observers.at(-1)!;
      io.cb(
        els.filter((el) => io.observed.has(el)).map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
    });

  const cap = (el: HTMLElement) =>
    Math.round(parseFloat(el.style.getPropertyValue("--snow-k") || "0") * parseFloat(el.style.getPropertyValue("--snow-max") || "0") * 10) / 10;

  it("drops about ten landers into the snow layer, behind the page", () => {
    render(<Effects />);
    const landers = document.querySelectorAll(".glacier-lander");
    expect(landers).toHaveLength(10);
    for (const l of landers) expect(l.closest(".glacier-snow")).not.toBeNull();
  });

  it("starts a card with snow already piled, then builds it to the max", () => {
    const { seen } = cards();
    show(seen);
    const start = cap(seen);
    expect(start).toBeGreaterThanOrEqual(16 * 0.4);
    expect(start).toBeLessThanOrEqual(16 * 0.7);
    act(() => vi.advanceTimersByTime(10_000));
    expect(cap(seen)).toBeGreaterThan(start);
    act(() => vi.advanceTimersByTime(600_000));
    expect(cap(seen)).toBe(16);
  });

  it("seeds each element the same way every time, and not every card alike", () => {
    const seeds = () => {
      render(
        <div data-theme="glacier" className="glacier">
          <Effects />
          {["Standings", "Ledger", "Rankings", "Stats", "Videos", "Brackets"].map((t, i) => (
            <div key={t} data-snow-cap data-testid={t} ref={(el) => void (el && place(el, 40, 100 + i * 100, 300, 60))}>
              {t}
            </div>
          ))}
        </div>,
      );
      const els = screen.getAllByTestId(/./);
      show(...els);
      const out = els.map(cap);
      cleanup();
      return out;
    };
    const first = seeds();
    expect(seeds()).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(3);
    for (const px of first) expect(px).toBeGreaterThan(0);
  });

  it("draws the drift mounded at both corners and dipping in the middle", () => {
    for (const seed of [0, 0.13, 0.5, 0.77, 0.999]) {
      const h = driftHeights(seed);
      const mid = h[Math.floor(h.length / 2)];
      expect(h[0]).toBeGreaterThan(mid + 0.3);
      expect(h.at(-1)!).toBeGreaterThan(mid + 0.3);
      expect(Math.max(...h)).toBeLessThanOrEqual(1);
    }
    expect(driftHeights(0.2)).not.toEqual(driftHeights(0.6));
    const { seen } = cards();
    show(seen);
    expect(seen.style.getPropertyValue("--snow-shape")).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it("gives buttons and big headings a small cap without touching their box", () => {
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <button type="button" className="gh-button" style={{ position: "absolute", width: 180, height: 44, padding: "0 16px" }}>
          Upload your chug
        </button>
        <h2 style={{ fontSize: "32px", margin: "0 0 12px" }}>Standings</h2>
        <h3 style={{ fontSize: "12px" }}>Week 2 awards</h3>
        <table>
          <tbody>
            <tr>
              <td>
                <h3 style={{ fontSize: "32px" }}>12.4</h3>
              </td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Upload your chug" });
    const heading = screen.getByRole("heading", { name: "Standings" });
    const label = screen.getByRole("heading", { name: "Week 2 awards" });
    const number = screen.getByRole("heading", { name: "12.4" });
    place(button, 40, 300, 180, 44);
    for (const el of [heading, label, number]) place(el, 40, 500, 600, 40);
    const box = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return [cs.position, cs.display, cs.width, cs.height, cs.padding, cs.margin, cs.border];
    };
    const before = [box(button), box(heading)];
    show(button, heading, label, number);
    act(() => vi.advanceTimersByTime(600_000));

    expect(button.dataset.snowKind).toBe("button");
    expect(cap(button)).toBe(6);
    expect(heading.dataset.snowKind).toBe("heading");
    expect(cap(heading)).toBe(5);
    expect([box(button), box(heading).slice(1)]).toEqual([before[0], before[1].slice(1)]);
    expect(heading.style.getPropertyValue("--snow-l")).toBe("20px");
    expect(heading.style.getPropertyValue("--snow-w")).toBe("160px");
    expect(label.dataset.snow).toBeUndefined();
    expect(number.dataset.snow).toBeUndefined();
    expect(observers.at(-1)!.observed.has(number)).toBe(false);
  });

  it("puts a thin cap on a card stacked tight under another", () => {
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <div data-snow-cap data-testid="top">
          1
        </div>
        <div data-snow-cap data-testid="under">
          2
        </div>
      </div>,
    );
    const top = screen.getByTestId("top");
    const under = screen.getByTestId("under");
    place(top, 40, 300, 300, 48);
    place(under, 40, 356, 300, 48);
    show(top, under);
    expect(cap(under)).toBeGreaterThan(0);
    expect(cap(under)).toBeLessThanOrEqual(4);
    act(() => vi.advanceTimersByTime(600_000));
    expect(cap(under)).toBe(4);
    expect(cap(top)).toBe(16);
  });

  it("tracks at most 40 targets, nearest the middle of the screen first", () => {
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        {Array.from({ length: 60 }, (_, i) => (
          <div key={i} data-snow-cap data-testid={`c${i}`} ref={(el) => void (el && place(el, (i % 3) * 320, Math.floor(i / 3) * 40, 300, 20))}>
            {`Card ${i}`}
          </div>
        ))}
      </div>,
    );
    const all = screen.getAllByTestId(/^c\d+$/);
    show(...all);
    act(() => vi.advanceTimersByTime(60_000));
    const capped = all.filter((el) => el.dataset.snow !== undefined);
    expect(capped).toHaveLength(40);
    // jsdom's window is 768 tall, so row 9 (y=360) is the middle and row 19 the far end.
    expect(capped).toContain(screen.getByTestId("c27"));
    expect(capped).not.toContain(screen.getByTestId("c57"));
  });

  it("only sends landers to cards in the viewport", () => {
    const { seen, offscreen } = cards();
    expect([...observers.at(-1)!.observed]).toEqual(expect.arrayContaining([seen, offscreen]));
    show(seen);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBe(16);
    expect(cap(offscreen)).toBe(0);
  });

  it("stops landing while the tab is hidden", () => {
    const { seen } = cards();
    show(seen);
    const start = cap(seen);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBe(start);
  });

  it("goes back to the seeded snow when the page changes", () => {
    const { seen } = cards();
    show(seen);
    const start = cap(seen);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cap(seen)).toBeGreaterThan(start);
    act(() => {
      window.history.pushState(null, "", "/?open=ices");
      vi.advanceTimersByTime(1_000);
    });
    expect(cap(seen)).toBe(start);
    window.history.pushState(null, "", "/");
  });

  it("shows the seeded caps still, with no falling snow, under reduced motion", () => {
    reducedMotion(true);
    render(
      <div data-theme="glacier" className="glacier">
        <Effects />
        <div data-snow-cap data-testid="card">
          Standings
        </div>
        {Array.from({ length: 20 }, (_, i) => (
          <h2 key={i} style={{ fontSize: "28px" }} data-testid="heading">{`Section ${i}`}</h2>
        ))}
      </div>,
    );
    const card = screen.getByTestId("card");
    const headings = screen.getAllByTestId("heading");
    place(card, 40, 400, 300, 120);
    headings.forEach((h, i) => place(h, 40, 20 + i * 30, 600, 24));
    show(card, ...headings);
    expect(document.querySelector(".glacier-flake, .glacier-lander")).toBeNull();
    const still = [card, ...headings].map(cap);
    expect(still[0]).toBeGreaterThanOrEqual(16 * 0.4);
    const dusted = still.slice(1).filter((px) => px > 0);
    expect(dusted.length).toBeGreaterThan(4);
    expect(dusted.length).toBeLessThan(16);
    for (const px of dusted) expect(px).toBeLessThanOrEqual(5);
    act(() => vi.advanceTimersByTime(120_000));
    expect([card, ...headings].map(cap)).toEqual(still);
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
