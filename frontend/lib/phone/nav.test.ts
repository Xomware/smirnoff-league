import { describe, expect, it } from "vitest";

import { navFromLinks, navReducer, parseScreens, type Screen, stackOf, stackUrl } from "./nav";

const team: Screen = { kind: "team", params: { rosterId: 3 } };
const player: Screen = { kind: "player", params: { playerId: "4046" } };
const game: Screen = { kind: "game", params: { matchup: 4, week: 3 } };
const root = (kind: Screen["kind"]): Screen => ({ kind, params: {} });
const open = (search: string) => navFromLinks(parseScreens(search));

describe("deep links", () => {
  it("starts on Home with nothing linked", () => {
    expect(open("")).toEqual({ tab: "home", stacks: { home: [root("home")] } });
  });

  it.each([
    ["?open=scores", "games", [root("games")]],
    ["?open=watch", "games", [root("games")]],
    ["?open=week:2", "games", [root("games"), { kind: "week", params: { week: 2 } }]],
    ["?open=games,game:3-4", "games", [root("games"), game]],
    ["?open=ices", "ices", [root("ices")]],
    ["?open=ice-standings", "ices", [root("ices")]],
    ["?open=videos", "ices", [root("ices")]],
    ["?open=folder:ices,stats", "ices", [root("ices"), root("stats")]],
    ["?open=standings", "menu", [root("menu"), root("standings")]],
    ["?open=team:3", "menu", [root("menu"), team]],
    ["?open=admin:users", "menu", [root("menu"), { kind: "admin", params: { panel: "users" } }]],
    ["?open=notifications", "home", [root("home"), root("notifications")]],
    ["?open=scores,team:3,player:4046", "games", [root("games"), team, player]],
  ])("%s opens the %s tab", (search, tab, stack) => {
    const nav = open(search);
    expect(nav.tab).toBe(tab);
    expect(stackOf(nav)).toEqual(stack);
  });

  it("drops what it cannot read", () => {
    expect(parseScreens("?open=bogus,game:0-3,game:4,game:4:3,team:3")).toEqual([team]);
  });

  it("writes a stack the way it reads one back", () => {
    const stack = [root("games"), game, team, player];
    expect(stackUrl([root("home")])).toBe("/");
    expect(stackUrl(stack)).toBe("/?open=games,game:3-4,team:3,player:4046");
    expect(stackOf(open(stackUrl(stack).slice(1)))).toEqual(stack);
  });
});

describe("navReducer", () => {
  const start = open("");

  it("pushes onto the current tab", () => {
    expect(stackOf(navReducer(start, { type: "push", screen: team }))).toEqual([root("home"), team]);
  });

  it("keeps each tab's stack when switching tabs", () => {
    let nav = navReducer(start, { type: "tab", tab: "menu" });
    nav = navReducer(nav, { type: "push", screen: team });
    nav = navReducer(nav, { type: "tab", tab: "games" });
    expect(stackOf(nav)).toEqual([root("games")]);

    nav = navReducer(nav, { type: "tab", tab: "menu" });
    expect(stackOf(nav)).toEqual([root("menu"), team]);
  });

  it("resets to the root when the current tab is tapped again", () => {
    let nav = navReducer(start, { type: "push", screen: team });
    nav = navReducer(nav, { type: "tab", tab: "home" });
    expect(stackOf(nav)).toEqual([root("home")]);
  });

  it("sets a tab's stack from a history entry", () => {
    const nav = navReducer(start, { type: "set", tab: "games", stack: [root("games"), game] });
    expect(nav.tab).toBe("games");
    expect(stackOf(nav)).toHaveLength(2);
    expect(nav.stacks.home).toHaveLength(1);
  });
});
