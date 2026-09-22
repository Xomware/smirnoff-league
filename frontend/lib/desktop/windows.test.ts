import { describe, expect, it } from "vitest";

import { activeWindow, defaultLayout, desktopReducer, type WindowState } from "./windows";

const size = { w: 400, h: 300 };

function openAll(...kinds: ("scores" | "standings" | "ices")[]): WindowState[] {
  return kinds.reduce<WindowState[]>((s, kind) => desktopReducer(s, { type: "open", kind, params: {}, size }), []);
}

const byKind = (state: WindowState[], kind: string) => state.find((w) => w.kind === kind)!;

describe("desktopReducer", () => {
  it("opens a window on top of the others", () => {
    const state = openAll("scores", "standings");

    expect(state.map((w) => w.id)).toEqual(["scores", "standings"]);
    expect(byKind(state, "standings").z).toBeGreaterThan(byKind(state, "scores").z);
    expect(byKind(state, "standings")).toMatchObject({ w: 400, h: 300, minimized: false, maximized: false });
    expect(activeWindow(state)?.kind).toBe("standings");
  });

  it("focuses an already-open window instead of opening a second one", () => {
    let state = desktopReducer(openAll("scores", "standings"), { type: "minimize", id: "scores" });

    state = desktopReducer(state, { type: "open", kind: "scores", params: {}, size });

    expect(state).toHaveLength(2);
    expect(byKind(state, "scores").minimized).toBe(false);
    expect(activeWindow(state)?.id).toBe("scores");
  });

  it("opens the same kind again when the params differ", () => {
    let state = desktopReducer([], { type: "open", kind: "scores", params: { week: 1 }, size });
    state = desktopReducer(state, { type: "open", kind: "scores", params: { week: 2 }, size });
    state = desktopReducer(state, { type: "open", kind: "scores", params: { week: 1 }, size });

    expect(state.map((w) => w.id)).toEqual(["scores:1", "scores:2"]);
  });

  it("closes a window", () => {
    const state = desktopReducer(openAll("scores", "standings"), { type: "close", id: "scores" });
    expect(state.map((w) => w.id)).toEqual(["standings"]);
  });

  it("brings a focused window to the top z", () => {
    const state = desktopReducer(openAll("scores", "standings", "ices"), { type: "focus", id: "scores" });

    const top = Math.max(...state.map((w) => w.z));
    expect(byKind(state, "scores").z).toBe(top);
    expect(activeWindow(state)?.id).toBe("scores");
  });

  it("leaves state alone when focusing the window already on top", () => {
    const state = openAll("scores", "standings");
    expect(desktopReducer(state, { type: "focus", id: "standings" })).toBe(state);
  });

  it("moves and resizes", () => {
    let state = desktopReducer(openAll("scores"), { type: "move", id: "scores", x: 50, y: 60 });
    state = desktopReducer(state, { type: "resize", id: "scores", w: 500, h: 420 });
    expect(byKind(state, "scores")).toMatchObject({ x: 50, y: 60, w: 500, h: 420 });
  });

  it("minimizes, and the next window down becomes active", () => {
    const state = desktopReducer(openAll("scores", "standings"), { type: "minimize", id: "standings" });

    expect(byKind(state, "standings").minimized).toBe(true);
    expect(activeWindow(state)?.id).toBe("scores");
  });

  it("maximizes and restores, focusing the window", () => {
    let state = desktopReducer(openAll("scores", "standings"), { type: "toggleMaximize", id: "scores" });
    expect(byKind(state, "scores").maximized).toBe(true);
    expect(activeWindow(state)?.id).toBe("scores");

    state = desktopReducer(state, { type: "toggleMaximize", id: "scores" });
    expect(byKind(state, "scores").maximized).toBe(false);
  });
});

describe("defaultLayout", () => {
  it("opens the summary, recap, standings and news, with the summary focused", () => {
    const layout = defaultLayout(1440, 900);

    expect(layout.map((w) => w.kind).sort()).toEqual(["home", "news", "recap", "standings"]);
    expect(activeWindow(layout)?.kind).toBe("home");
    const home = byKind(layout, "home");
    expect(byKind(layout, "recap").y).toBeGreaterThan(home.y + home.h - 1);
    expect(byKind(layout, "standings").x).toBeGreaterThanOrEqual(home.x + home.w);
    for (const w of layout) expect(w.x + w.w).toBeLessThanOrEqual(1440);
  });
});
