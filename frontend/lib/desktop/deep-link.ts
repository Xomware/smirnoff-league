import { ADMIN_PANELS, type AdminPanel } from "@/components/admin/ControlPanel";
import { STATS_TABS } from "@/components/views/stats-view";
import { TEAM_TABS } from "@/components/views/team-view";
import { REGISTRY, type WindowKind } from "./registry";
import {
  activeWindow,
  bottomChrome,
  desktopReducer,
  windowId,
  type WindowParams,
  type WindowState,
} from "./windows";

export interface WindowLink {
  kind: WindowKind;
  params: WindowParams;
}

const POSITIVE = /^[1-9]\d*$/;
const tabOf = (tabs: string[], v: string) => (tabs.includes(v) ? { tab: v } : null);

// A link names a window by its id, `kind` or `kind:value`, so these are the
// kinds that take a value and how to read it back into params.
const PARAMS: Partial<Record<WindowKind, (value: string) => WindowParams | null>> = {
  team: (v): WindowParams | null => {
    const [id, tab, ...rest] = v.split(":");
    if (!POSITIVE.test(id) || rest.length > 0) return null;
    if (tab === undefined) return { rosterId: Number(id) };
    return TEAM_TABS.includes(tab) ? { rosterId: Number(id), tab } : null;
  },
  "my-team": (v) => tabOf(TEAM_TABS, v),
  stats: (v) => tabOf(STATS_TABS, v),
  player: (v) => (/^[A-Za-z0-9]+$/.test(v) ? { playerId: v } : null),
  week: (v) => (POSITIVE.test(v) ? { week: Number(v) } : null),
  game: (v) => {
    const [, week, matchup] = v.match(/^([1-9]\d*)-([1-9]\d*)$/) ?? [];
    return week ? { week: Number(week), matchup: Number(matchup) } : null;
  },
  writeup: (v) => (POSITIVE.test(v) ? { week: Number(v) } : null),
  folder: (v) => (v === "ices" ? { id: v } : null),
  admin: (v) => (ADMIN_PANELS.includes(v as AdminPanel) ? { panel: v } : null),
};

// Kinds whose value may be left off: a bare `writeup` is the latest edition,
// a bare `admin` the category view, and a view with tabs opens on its first.
const OPTIONAL = new Set<WindowKind>(["writeup", "admin", "my-team", "stats"]);

const isKind = (kind: string): kind is WindowKind => Object.hasOwn(REGISTRY, kind);

export function parseOpen(search: string): WindowLink[] {
  const list = new URLSearchParams(search).get("open");
  if (!list) return [];
  return list.split(",").flatMap((token) => {
    // Only a team's value holds a colon, between its roster and its tab.
    const [kind, ...values] = token.split(":");
    const value = values.length > 0 ? values.join(":") : undefined;
    if (!isKind(kind)) return [];
    const read = PARAMS[kind];
    if (!read) return value === undefined ? [{ kind, params: {} }] : [];
    if (value === undefined) return OPTIONAL.has(kind) ? [{ kind, params: {} }] : [];
    const params = read(value);
    return params ? [{ kind, params }] : [];
  });
}

// A window keeps its id when it navigates, so a link names what it shows now.
const showing = (w: WindowState) => windowId(w.kind, w.params);

// Lowest first and the active window last, so opening the list in order
// rebuilds the same stack.
export function openParam(windows: WindowState[]): string {
  const active = activeWindow(windows);
  const rest = windows.filter((w) => w !== active).sort((a, b) => a.z - b.z);
  return [...rest, ...(active ? [active] : [])].map(showing).join(",");
}

export function syncUrl(windows: WindowState[]) {
  const ids = openParam(windows);
  // Null state, not history.state: Next skips updating its own router URL
  // when handed its internal state back, and would later restore the old one.
  window.history.replaceState(null, "", ids ? `/?open=${ids}` : "/");
}

export const windowUrl = (w: WindowState) => `${window.location.origin}/?open=${showing(w)}`;

// The linked windows replace the base layout, but one the user had saved
// comes back where they left it.
export function openLinks(base: WindowState[], links: WindowLink[], vw: number, vh: number): WindowState[] {
  if (links.length === 0) return base;
  return links.reduce<WindowState[]>((state, { kind, params }) => {
    const { w, h } = REGISTRY[kind].defaultSize;
    const open = { type: "open", kind, params, size: { w: Math.min(w, vw), h: Math.min(h, vh - bottomChrome()) } } as const;
    const id = windowId(kind, params);
    const saved = base.find((s) => showing(s) === id);
    if (!saved || state.some((s) => s.id === saved.id || showing(s) === id)) return desktopReducer(state, open);
    return desktopReducer([...state, { ...saved, minimized: false, z: 0 }], { type: "focus", id: saved.id });
  }, []);
}
