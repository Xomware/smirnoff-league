import { describe, expect, it } from "vitest";

import { openLinks, openParam, parseOpen } from "./deep-link";
import { activeWindow, defaultLayout, desktopReducer, type WindowState } from "./windows";

describe("parseOpen", () => {
  it("keeps the listed order and turns params into window params", () => {
    expect(parseOpen("?open=standings,team:6,player:8121,week:2")).toEqual([
      { kind: "standings", params: {} },
      { kind: "team", params: { rosterId: 6 } },
      { kind: "player", params: { playerId: "8121" } },
      { kind: "week", params: { week: 2 } },
    ]);
  });

  it("reads a percent-encoded list", () => {
    expect(parseOpen("?open=scores%2Cteam%3A3")).toEqual([
      { kind: "scores", params: {} },
      { kind: "team", params: { rosterId: 3 } },
    ]);
  });

  it("ignores unknown kinds", () => {
    expect(parseOpen("?open=minesweeper,toString,scores")).toEqual([{ kind: "scores", params: {} }]);
  });

  it("ignores bad or missing params", () => {
    const bad = "team,team:abc,team:0,week:-1,player:,player:81/21,standings:5,team:6:7";
    expect(parseOpen(`?open=${bad},ices`)).toEqual([{ kind: "ices", params: {} }]);
  });

  it("returns nothing without an open param", () => {
    expect(parseOpen("")).toEqual([]);
    expect(parseOpen("?other=1")).toEqual([]);
  });
});

const size = { w: 400, h: 300 };
const open = (state: WindowState[], kind: "scores" | "standings" | "team", params = {}) =>
  desktopReducer(state, { type: "open", kind, params, size });

describe("openParam", () => {
  it("lists every window, lowest first, with the active one last", () => {
    let state = open(open(open([], "scores"), "standings"), "team", { rosterId: 6 });
    state = desktopReducer(state, { type: "focus", id: "scores" });
    state = desktopReducer(state, { type: "minimize", id: "scores" });

    expect(openParam(state)).toBe("standings,scores,team:6");
  });

  it("round-trips through parseOpen", () => {
    const state = open(open([], "team", { rosterId: 6 }), "standings");
    expect(parseOpen(`?open=${openParam(state)}`).map((l) => l.kind)).toEqual(["team", "standings"]);
  });
});

describe("openLinks", () => {
  const base = defaultLayout(1440, 900);

  it("opens only the linked windows, keeping saved geometry, and focuses the last", () => {
    const saved = base.find((w) => w.id === "standings")!;

    const state = openLinks(base, parseOpen("?open=standings,team:6"), 1440, 900);

    expect(state.map((w) => w.id)).toEqual(["standings", "team:6"]);
    expect(state[0]).toMatchObject({ x: saved.x, y: saved.y, w: saved.w, h: saved.h });
    expect(activeWindow(state)?.id).toBe("team:6");
  });

  it("restores a minimized saved window", () => {
    const minimized = base.map((w) => (w.id === "news" ? { ...w, minimized: true } : w));
    expect(openLinks(minimized, parseOpen("?open=news"), 1440, 900)[0].minimized).toBe(false);
  });

  it("returns the base layout when nothing is linked", () => {
    expect(openLinks(base, [], 1440, 900)).toBe(base);
  });
});
