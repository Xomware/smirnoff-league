import { describe, expect, it } from "vitest";

import { type League, windowTitle } from "./registry";
import { activeWindow, defaultLayout, desktopReducer, historyOf, type WindowState } from "./windows";

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

  it("restores a whole layout, which is how the desktop resets", () => {
    const layout = defaultLayout(1440, 900);
    expect(desktopReducer(openAll("scores", "ices"), { type: "restore", windows: layout })).toBe(layout);
  });
});

// Enough league for the titles that don't read it; named titles are in desktop.test.tsx.
const noLeague: League = {
  data: null,
  teamFor: () => ({ name: "", avatarUrl: null, record: { wins: 0, losses: 0, ties: 0 } }),
};

describe("window history", () => {
  const standings = () => openAll("standings");
  const nav = (state: WindowState[], kind: "team" | "player" | "week", params: Record<string, number | string>) =>
    desktopReducer(state, { type: "navigate", id: "standings", kind, params });

  it("navigates in place, pushing history and retitling the window", () => {
    const state = nav(nav(standings(), "team", { rosterId: 6 }), "week", { week: 3 });

    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ id: "standings", kind: "week", params: { week: 3 } });
    expect(windowTitle(state[0], noLeague)).toBe("Week 3");
    expect(historyOf(state[0])).toEqual({
      views: [
        { kind: "standings", params: {} },
        { kind: "team", params: { rosterId: 6 } },
        { kind: "week", params: { week: 3 } },
      ],
      at: 2,
    });
  });

  it("goes back and forward, and stops at the ends", () => {
    let state = nav(standings(), "team", { rosterId: 6 });

    state = desktopReducer(state, { type: "back", id: "standings" });
    expect(state[0]).toMatchObject({ kind: "standings", params: {} });
    expect(windowTitle(state[0], noLeague)).toBe("League Standings");
    expect(desktopReducer(state, { type: "back", id: "standings" })).toBe(state);

    state = desktopReducer(state, { type: "forward", id: "standings" });
    expect(state[0]).toMatchObject({ kind: "team", params: { rosterId: 6 } });
    expect(desktopReducer(state, { type: "forward", id: "standings" })).toBe(state);
  });

  it("drops forward entries when navigating from the middle", () => {
    let state = nav(nav(standings(), "team", { rosterId: 6 }), "player", { playerId: "8121" });
    state = desktopReducer(desktopReducer(state, { type: "back", id: "standings" }), { type: "back", id: "standings" });

    state = nav(state, "week", { week: 1 });

    expect(historyOf(state[0]).views.map((v) => v.kind)).toEqual(["standings", "week"]);
    expect(desktopReducer(state, { type: "forward", id: "standings" })).toBe(state);
  });

  it("navigates in place even when another window already shows the target", () => {
    let state = desktopReducer(standings(), { type: "open", kind: "team", params: { rosterId: 6 }, size });
    state = nav(state, "team", { rosterId: 6 });

    expect(state.map((w) => [w.id, w.kind])).toEqual([
      ["standings", "team"],
      ["team:6", "team"],
    ]);
  });

  it("opens a fresh window when the one with that id has navigated elsewhere", () => {
    let state = nav(standings(), "team", { rosterId: 6 });
    state = desktopReducer(state, { type: "open", kind: "standings", params: {}, size });

    expect(state).toHaveLength(2);
    expect(new Set(state.map((w) => w.id)).size).toBe(2);
    expect(activeWindow(state)?.kind).toBe("standings");
  });
});

describe("defaultLayout", () => {
  it("opens ice-first: the summary, Ice Standings in the big right slot, the News Drop, and the recap minimized", () => {
    const layout = defaultLayout(1440, 900);

    expect(layout.map((w) => w.kind).sort()).toEqual(["home", "ice-standings", "recap", "writeup"]);
    expect(activeWindow(layout)?.kind).toBe("home");
    const home = byKind(layout, "home");
    const iceStandings = byKind(layout, "ice-standings");
    expect(iceStandings.x).toBeGreaterThanOrEqual(home.x + home.w);
    expect(iceStandings.h).toBeGreaterThan(home.h);
    expect(byKind(layout, "writeup").y).toBeGreaterThan(home.y + home.h - 1);
    expect(byKind(layout, "recap").minimized).toBe(true);
    for (const w of layout) {
      expect(w.x + w.w).toBeLessThanOrEqual(1440);
      expect(w.y + w.h).toBeLessThanOrEqual(900 - 44);
    }
  });
});
