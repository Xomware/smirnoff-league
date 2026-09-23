import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runThemeTransition } from "./transition";

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const overlays = () => document.querySelectorAll(".theme-transition");

const track = (p: Promise<void>) => {
  const state = { done: false };
  void p.then(() => (state.done = true));
  return state;
};

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  reducedMotion(false);
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("runThemeTransition", () => {
  it.each(["glacier", "xp"] as const)("to %s: applies once while covered, then removes the overlay", async (to) => {
    const apply = vi.fn();
    const run = track(runThemeTransition(to, apply));

    expect(overlays()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(apply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(overlays()).toHaveLength(1);
    expect(run.done).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(run.done).toBe(true);
    expect(overlays()).toHaveLength(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion applies without the overlay and finishes within 200ms", async () => {
    reducedMotion(true);
    const apply = vi.fn();
    const run = track(runThemeTransition("glacier", apply));

    expect(overlays()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(run.done).toBe(true);
  });

  it("under reduced motion crossfades through a view transition when supported", async () => {
    reducedMotion(true);
    const start = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.assign(document, { startViewTransition: start });
    const apply = vi.fn();

    await runThemeTransition("xp", apply);

    expect(start).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("theme-fade")).toBe(false);
  });

  it("ignores a second call while one is running", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const a = track(runThemeTransition("glacier", first));
    const b = track(runThemeTransition("xp", second));

    expect(overlays()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1200);
    expect([a.done, b.done]).toEqual([true, true]);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(overlays()).toHaveLength(0);

    const third = vi.fn();
    const c = track(runThemeTransition("xp", third));
    await vi.advanceTimersByTimeAsync(1200);
    expect(third).toHaveBeenCalledTimes(1);
    expect(c.done).toBe(true);
    expect(overlays()).toHaveLength(0);
  });

  it("removes the overlay and rejects when apply throws", async () => {
    const run = runThemeTransition("glacier", () => {
      throw new Error("boom");
    });
    const settled = expect(run).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(1200);
    await settled;
    expect(overlays()).toHaveLength(0);

    const apply = vi.fn();
    const next = runThemeTransition("xp", apply);
    await vi.advanceTimersByTimeAsync(1200);
    await next;
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
