import type { WindowLink } from "@/lib/desktop/deep-link";
import { windowId, type WindowView } from "@/lib/desktop/windows";

export const TABS = ["home", "scores", "ices", "standings"] as const;
export type Tab = (typeof TABS)[number];

export interface Nav {
  tab: Tab;
  // A tab has a stack once it has been visited, so unvisited tabs never mount.
  stacks: Partial<Record<Tab, WindowView[]>>;
}

export type NavAction =
  | { type: "push"; view: WindowView }
  | { type: "tab"; tab: Tab }
  | { type: "set"; tab: Tab; stack: WindowView[] };

const root = (tab: Tab): WindowView[] => [{ kind: tab, params: {} }];
const isTab = (kind: string): kind is Tab => (TABS as readonly string[]).includes(kind);

export const stackOf = (nav: Nav): WindowView[] => nav.stacks[nav.tab] ?? root(nav.tab);

// A link list opens on its first item's tab when that is a tab, otherwise on
// Home, and every other link is pushed on top in order.
export function navFromLinks(links: WindowLink[]): Nav {
  const [first] = links;
  if (first && isTab(first.kind)) return { tab: first.kind, stacks: { [first.kind]: links } };
  return { tab: "home", stacks: { home: [...root("home"), ...links] } };
}

export function navReducer(nav: Nav, action: NavAction): Nav {
  switch (action.type) {
    case "push":
      return { ...nav, stacks: { ...nav.stacks, [nav.tab]: [...stackOf(nav), action.view] } };
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

export function stackUrl(stack: WindowView[]): string {
  if (stack.length === 1 && stack[0].kind === "home") return "/";
  return `/?open=${stack.map((v) => windowId(v.kind, v.params)).join(",")}`;
}
