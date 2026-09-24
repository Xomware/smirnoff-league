import { parseOpen } from "@/lib/desktop/deep-link";
import type { WindowKind } from "@/lib/desktop/registry";
import { windowId, type WindowParams } from "@/lib/desktop/windows";
import { SECTIONS, sectionOf } from "@/lib/sections";

// Every section in lib/sections, plus XP's Menu tab.
export const TABS = ["home", "games", "ices", "league", "news-drop", "menu"] as const;
export type Tab = (typeof TABS)[number];

const PHONE_KINDS = ["menu", "teams", "profile", "settings"] as const;
const isPhoneKind = (token: string): token is (typeof PHONE_KINDS)[number] => (PHONE_KINDS as readonly string[]).includes(token);

// The registry's kinds plus the phone's own screens.
export type ScreenKind = WindowKind | (typeof PHONE_KINDS)[number];

export interface Screen {
  kind: ScreenKind;
  params: WindowParams;
}

export interface Nav {
  tab: Tab;
  // A section's stack starts with the subpage its sub-tabs have picked, then
  // whatever was drilled into from it. Unvisited tabs never mount.
  stacks: Partial<Record<Tab, Screen[]>>;
}

export type NavAction =
  | { type: "push"; screen: Screen }
  | { type: "tab"; tab: Tab }
  | { type: "open"; tab: Tab; screen: Screen }
  | { type: "set"; tab: Tab; stack: Screen[] };

export const sectionFor = (tab: Tab) => SECTIONS.find((s) => s.id === tab);

// The section that lists kind as a page, preferring the one you are in, as the desktop sub-nav does.
export function pageTab(kind: ScreenKind, from?: Tab): Tab | undefined {
  const lists = (id?: string) => SECTIONS.find((s) => s.id === id && !s.account && s.pages.some((p) => p.kind === kind));
  return (lists(from) ?? SECTIONS.find((s) => lists(s.id)))?.id as Tab | undefined;
}

// Where a link to a drill-down or an account page opens.
function tabFor(kind: Exclude<ScreenKind, "menu">): Tab {
  if (kind === "notifications") return "home";
  const section = sectionOf(kind);
  return section.account ? "menu" : (section.id as Tab);
}

export const rootOf = (tab: Tab): Screen => ({ kind: sectionFor(tab)?.pages[0].kind ?? "menu", params: {} });

export const stackOf = (nav: Nav): Screen[] => nav.stacks[nav.tab] ?? [rootOf(nav.tab)];

export const screenId = ({ kind, params }: Screen) => windowId(kind, params);

export function parseScreens(search: string): Screen[] {
  const list = new URLSearchParams(search).get("open");
  if (!list) return [];
  return list.split(",").flatMap((token): Screen[] => {
    // The Games tab's own screen before it had sub-tabs; old links still name it.
    if (token === "games") return [{ kind: "scores", params: {} }];
    if (isPhoneKind(token)) return [{ kind: token, params: {} }];
    return parseOpen(`?open=${encodeURIComponent(token)}`);
  });
}

// The first link picks the section, and its subpage if it is one; the rest are drilled into.
export function navFromLinks([first, ...rest]: Screen[]): Nav {
  if (!first) return { tab: "home", stacks: { home: [rootOf("home")] } };
  if (first.kind === "menu") return { tab: "menu", stacks: { menu: [first, ...rest] } };
  const page = pageTab(first.kind);
  const tab = page ?? tabFor(first.kind);
  return { tab, stacks: { [tab]: page ? [first, ...rest] : [rootOf(tab), first, ...rest] } };
}

export function navReducer(nav: Nav, action: NavAction): Nav {
  switch (action.type) {
    case "push":
      return { ...nav, stacks: { ...nav.stacks, [nav.tab]: [...stackOf(nav), action.screen] } };
    case "tab": {
      // Tapping the tab you are already on goes back to its root, as on iOS.
      const { tab } = action;
      const stack = tab === nav.tab ? stackOf(nav).slice(0, 1) : (nav.stacks[tab] ?? [rootOf(tab)]);
      return { tab, stacks: { ...nav.stacks, [tab]: stack } };
    }
    case "open":
      return { tab: action.tab, stacks: { ...nav.stacks, [action.tab]: [action.screen] } };
    case "set":
      return { tab: action.tab, stacks: { ...nav.stacks, [action.tab]: action.stack } };
  }
}

export function stackUrl(stack: Screen[]): string {
  if (stack.length === 1 && stack[0].kind === "home") return "/";
  return `/?open=${stack.map(screenId).join(",")}`;
}
