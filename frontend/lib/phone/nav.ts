import { parseOpen } from "@/lib/desktop/deep-link";
import type { WindowKind } from "@/lib/desktop/registry";
import type { WindowParams } from "@/lib/desktop/windows";

export const TABS = ["home", "games", "ices", "menu"] as const;
export type Tab = (typeof TABS)[number];

// The registry's kinds plus the phone's own screens. The registry's `home`
// and `ices` kinds name the Home and Ices tabs.
export type ScreenKind = WindowKind | "games" | "menu" | "teams" | "game";

export interface Screen {
  kind: ScreenKind;
  params: WindowParams;
}

export interface Nav {
  tab: Tab;
  // A tab has a stack once it has been visited, so unvisited tabs never mount.
  stacks: Partial<Record<Tab, Screen[]>>;
}

export type NavAction = { type: "push"; screen: Screen } | { type: "tab"; tab: Tab } | { type: "set"; tab: Tab; stack: Screen[] };

// Desktop windows whose content a tab's own page already shows: a link to
// one opens that tab rather than pushing a screen.
const FOLDED: Partial<Record<ScreenKind, Tab>> = {
  home: "home",
  games: "games",
  scores: "games",
  watch: "games",
  ices: "ices",
  "ice-standings": "ices",
  videos: "ices",
  folder: "ices",
  menu: "menu",
};
const OPENS_ON: Partial<Record<ScreenKind, Tab>> = { week: "games", game: "games", notifications: "home" };

export const foldedInto = (kind: ScreenKind): Tab | undefined => FOLDED[kind];
const tabFor = (kind: ScreenKind): Tab => FOLDED[kind] ?? OPENS_ON[kind] ?? "menu";
const root = (tab: Tab): Screen[] => [{ kind: tab, params: {} }];

export const stackOf = (nav: Nav): Screen[] => nav.stacks[nav.tab] ?? root(nav.tab);

// The same shape as windowId, params sorted by key, so a game reads game:<matchup>:<week>.
export const screenId = ({ kind, params }: Screen) => [kind, ...Object.keys(params).sort().map((k) => params[k])].join(":");

export function parseScreens(search: string): Screen[] {
  const list = new URLSearchParams(search).get("open");
  if (!list) return [];
  return list.split(",").flatMap((token): Screen[] => {
    if (token === "games" || token === "menu" || token === "teams") return [{ kind: token, params: {} }];
    const game = token.match(/^game:([1-9]\d*):([1-9]\d*)$/);
    if (game) return [{ kind: "game", params: { matchup: Number(game[1]), week: Number(game[2]) } }];
    return parseOpen(`?open=${encodeURIComponent(token)}`);
  });
}

// The first link picks the tab; the rest are pushed on its root in order.
export function navFromLinks(links: Screen[]): Nav {
  const tab = links[0] ? tabFor(links[0].kind) : "home";
  return { tab, stacks: { [tab]: [...root(tab), ...links.filter((l) => !FOLDED[l.kind])] } };
}

export function navReducer(nav: Nav, action: NavAction): Nav {
  switch (action.type) {
    case "push":
      return { ...nav, stacks: { ...nav.stacks, [nav.tab]: [...stackOf(nav), action.screen] } };
    case "tab": {
      // Tapping the tab you are already on goes back to its root, as on iOS.
      const { tab } = action;
      const stack = tab === nav.tab ? root(tab) : (nav.stacks[tab] ?? root(tab));
      return { tab, stacks: { ...nav.stacks, [tab]: stack } };
    }
    case "set":
      return { tab: action.tab, stacks: { ...nav.stacks, [action.tab]: action.stack } };
  }
}

export function stackUrl(stack: Screen[]): string {
  if (stack.length === 1 && stack[0].kind === "home") return "/";
  return `/?open=${stack.map(screenId).join(",")}`;
}
