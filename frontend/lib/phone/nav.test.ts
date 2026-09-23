import { describe, expect, it } from "vitest";

import { parseOpen } from "@/lib/desktop/deep-link";
import { navFromLinks, navReducer, stackOf, stackUrl } from "./nav";

const team = { kind: "team", params: { rosterId: 3 } } as const;
const player = { kind: "player", params: { playerId: "4046" } } as const;

describe("navFromLinks", () => {
  it("starts on Home with nothing linked", () => {
    expect(navFromLinks([])).toEqual({ tab: "home", stacks: { home: [{ kind: "home", params: {} }] } });
  });

  it("opens a linked tab with the rest of the links on top, last item on top", () => {
    const nav = navFromLinks(parseOpen("?open=scores,team:3,player:4046"));
    expect(nav.tab).toBe("scores");
    expect(stackOf(nav)).toEqual([{ kind: "scores", params: {} }, team, player]);
  });

  it("stacks links that are not a tab on Home", () => {
    const nav = navFromLinks(parseOpen("?open=brackets,team:3"));
    expect(nav.tab).toBe("home");
    expect(stackOf(nav).map((v) => v.kind)).toEqual(["home", "brackets", "team"]);
  });
});

describe("navReducer", () => {
  const start = navFromLinks([]);

  it("pushes onto the current tab", () => {
    const nav = navReducer(start, { type: "push", view: team });
    expect(stackOf(nav)).toEqual([{ kind: "home", params: {} }, team]);
  });

  it("keeps each tab's stack when switching tabs", () => {
    let nav = navReducer(start, { type: "tab", tab: "standings" });
    nav = navReducer(nav, { type: "push", view: team });
    nav = navReducer(nav, { type: "tab", tab: "scores" });
    expect(stackOf(nav)).toEqual([{ kind: "scores", params: {} }]);

    nav = navReducer(nav, { type: "tab", tab: "standings" });
    expect(stackOf(nav)).toEqual([{ kind: "standings", params: {} }, team]);
  });

  it("resets to the root when the current tab is tapped again", () => {
    let nav = navReducer(start, { type: "push", view: team });
    nav = navReducer(nav, { type: "tab", tab: "home" });
    expect(stackOf(nav)).toEqual([{ kind: "home", params: {} }]);
  });

  it("sets a tab's stack from a history entry", () => {
    const nav = navReducer(start, { type: "set", tab: "scores", stack: [{ kind: "scores", params: {} }, team] });
    expect(nav.tab).toBe("scores");
    expect(stackOf(nav)).toHaveLength(2);
    expect(nav.stacks.home).toHaveLength(1);
  });
});

describe("stackUrl", () => {
  it("links the stack the way ?open= reads it back", () => {
    expect(stackUrl([{ kind: "home", params: {} }])).toBe("/");
    expect(stackUrl([{ kind: "scores", params: {} }, team, player])).toBe("/?open=scores,team:3,player:4046");
  });
});
