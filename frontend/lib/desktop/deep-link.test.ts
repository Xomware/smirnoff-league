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

  it("opens the Ices overview and still the ledger by its old link", () => {
    expect(parseOpen("?open=ices-overview,ices,ices-overview:2")).toEqual([
      { kind: "ices-overview", params: {} },
      { kind: "ices", params: {} },
    ]);
  });

  it("reads a game as week-matchup", () => {
    expect(parseOpen("?open=game:1-7,game:1,game:0-7,game:1-7-2,game:1:7")).toEqual([{ kind: "game", params: { week: 1, matchup: 7 } }]);
  });

  it("opens a folder by id", () => {
    expect(parseOpen("?open=folder:ices,folder,folder:system32")).toEqual([{ kind: "folder", params: { id: "ices" } }]);
  });

  it("opens the Control Panel home or one of its panels", () => {
    expect(parseOpen("?open=admin,admin:rules,admin:users,admin:system")).toEqual([
      { kind: "admin", params: {} },
      { kind: "admin", params: { panel: "rules" } },
      { kind: "admin", params: { panel: "users" } },
    ]);
  });

  it("reads the inner tab a Stats or team link names", () => {
    expect(parseOpen("?open=stats:positions,team:6:ices,my-team:roster,stats:nope,team:6:nope,my-team:6")).toEqual([
      { kind: "stats", params: { tab: "positions" } },
      { kind: "team", params: { rosterId: 6, tab: "ices" } },
      { kind: "my-team", params: { tab: "roster" } },
    ]);
  });

  it("opens Awards on the latest week or the week it names", () => {
    expect(parseOpen("?open=awards,awards:3,awards:0,awards:x")).toEqual([
      { kind: "awards", params: {} },
      { kind: "awards", params: { week: 3 } },
    ]);
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

  it("names a window that navigated by what it shows now", () => {
    const state = desktopReducer(open([], "standings"), { type: "navigate", id: "standings", kind: "team", params: { rosterId: 6 } });
    expect(openParam(state)).toBe("team:6");
  });

  it("round-trips a game through parseOpen", () => {
    const state = desktopReducer([], { type: "open", kind: "game", params: { week: 1, matchup: 7 }, size });
    expect(openParam(state)).toBe("game:1-7");
    expect(parseOpen(`?open=${openParam(state)}`)).toEqual([{ kind: "game", params: { week: 1, matchup: 7 } }]);
  });

  it("round-trips through parseOpen", () => {
    const state = open(open([], "team", { rosterId: 6 }), "standings");
    expect(parseOpen(`?open=${openParam(state)}`).map((l) => l.kind)).toEqual(["team", "standings"]);
  });
});

describe("openLinks", () => {
  const base = defaultLayout(1440, 900);

  it("opens only the linked windows, keeping saved geometry, and focuses the last", () => {
    const saved = base.find((w) => w.id === "ice-standings")!;

    const state = openLinks(base, parseOpen("?open=ice-standings,team:6"), 1440, 900);

    expect(state.map((w) => w.id)).toEqual(["ice-standings", "team:6"]);
    expect(state[0]).toMatchObject({ x: saved.x, y: saved.y, w: saved.w, h: saved.h });
    expect(activeWindow(state)?.id).toBe("team:6");
  });

  it("finds a saved window by the view it shows, keeping its history", () => {
    const navigated = desktopReducer(base, { type: "navigate", id: "ice-standings", kind: "team", params: { rosterId: 6 } });

    const [team] = openLinks(navigated, parseOpen("?open=team:6"), 1440, 900);

    expect(team).toMatchObject({ id: "ice-standings", kind: "team", params: { rosterId: 6 } });
    expect(team.history?.views).toHaveLength(2);
  });

  it("does not reuse a saved window's id already taken by an earlier link", () => {
    const navigated = desktopReducer(base, { type: "navigate", id: "ice-standings", kind: "team", params: { rosterId: 6 } });

    const state = openLinks(navigated, parseOpen("?open=ice-standings,team:6"), 1440, 900);

    expect(new Set(state.map((w) => w.id)).size).toBe(2);
    expect(state.map((w) => w.kind)).toEqual(["ice-standings", "team"]);
  });

  it("restores a minimized saved window", () => {
    const minimized = base.map((w) => (w.id === "writeup" ? { ...w, minimized: true } : w));
    expect(openLinks(minimized, parseOpen("?open=writeup"), 1440, 900)[0].minimized).toBe(false);
  });

  it("returns the base layout when nothing is linked", () => {
    expect(openLinks(base, [], 1440, 900)).toBe(base);
  });
});
