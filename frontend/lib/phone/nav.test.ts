import { describe, expect, it } from "vitest";

import { navFromLinks, navReducer, pageTab, parseScreens, type Screen, stackOf, stackUrl } from "./nav";

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
    ["?open=scores", "games", [root("scores")]],
    ["?open=watch", "games", [root("watch")]],
    ["?open=week:2", "games", [{ kind: "week", params: { week: 2 } }]],
    ["?open=game:3-4", "games", [root("watch"), game]],
    ["?open=games,game:3-4", "games", [root("scores"), game]],
    ["?open=ices", "ices", [root("ices")]],
    ["?open=ice-standings", "ices", [root("ice-standings")]],
    ["?open=videos", "ices", [root("videos")]],
    ["?open=stats", "ices", [root("stats")]],
    ["?open=standings", "league", [root("standings")]],
    ["?open=news", "league", [root("news")]],
    ["?open=team:3", "league", [root("standings"), team]],
    ["?open=writeup", "news-drop", [root("writeup")]],
    ["?open=admin:users", "menu", [root("menu"), { kind: "admin", params: { panel: "users" } }]],
    ["?open=notifications", "home", [root("home"), root("notifications")]],
    ["?open=scores,team:3,player:4046", "games", [root("scores"), team, player]],
  ])("%s opens the %s section", (search, tab, stack) => {
    const nav = open(search);
    expect(nav.tab).toBe(tab);
    expect(stackOf(nav)).toEqual(stack);
  });

  it("drops what it cannot read", () => {
    expect(parseScreens("?open=bogus,game:0-3,game:4,game:4:3,team:3")).toEqual([team]);
  });

  it("writes a stack the way it reads one back", () => {
    const stack = [root("ice-standings"), game, team, player];
    expect(stackUrl([root("home")])).toBe("/");
    expect(stackUrl(stack)).toBe("/?open=ice-standings,game:3-4,team:3,player:4046");
    expect(stackOf(open(stackUrl(stack).slice(1)))).toEqual(stack);
  });
});

describe("pageTab", () => {
  it("finds the section that lists a page, preferring the one you are in", () => {
    expect(pageTab("brackets", "home")).toBe("games");
    expect(pageTab("brackets", "league")).toBe("league");
    expect(pageTab("news", "news-drop")).toBe("news-drop");
    expect(pageTab("team", "league")).toBeUndefined();
    expect(pageTab("settings", "home")).toBeUndefined();
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
    expect(stackOf(nav)).toEqual([root("watch")]);

    nav = navReducer(nav, { type: "tab", tab: "menu" });
    expect(stackOf(nav)).toEqual([root("menu"), team]);
  });

  it("resets to the root when the current tab is tapped again", () => {
    let nav = navReducer(start, { type: "push", screen: team });
    nav = navReducer(nav, { type: "tab", tab: "home" });
    expect(stackOf(nav)).toEqual([root("home")]);
  });

  it("returns to the subpage it was on when the current tab is tapped again", () => {
    let nav = navReducer(start, { type: "open", tab: "ices", screen: root("stats") });
    nav = navReducer(nav, { type: "push", screen: team });
    nav = navReducer(nav, { type: "tab", tab: "ices" });
    expect(stackOf(nav)).toEqual([root("stats")]);
  });

  it("opens a subpage as its section's root, dropping what was drilled into", () => {
    let nav = navReducer(start, { type: "open", tab: "ices", screen: root("ices") });
    nav = navReducer(nav, { type: "push", screen: team });
    nav = navReducer(nav, { type: "open", tab: "ices", screen: root("videos") });
    expect(nav.tab).toBe("ices");
    expect(stackOf(nav)).toEqual([root("videos")]);
    expect(stackOf(navReducer(nav, { type: "tab", tab: "home" }))).toEqual([root("home")]);
  });

  it("sets a tab's stack from a history entry", () => {
    const nav = navReducer(start, { type: "set", tab: "games", stack: [root("scores"), game] });
    expect(nav.tab).toBe("games");
    expect(stackOf(nav)).toHaveLength(2);
    expect(nav.stacks.home).toHaveLength(1);
  });
});
