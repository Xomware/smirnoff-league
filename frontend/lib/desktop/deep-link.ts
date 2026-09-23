import { REGISTRY, type WindowKind } from "./registry";
import {
  activeWindow,
  desktopReducer,
  TASKBAR_HEIGHT,
  windowId,
  type WindowParams,
  type WindowState,
} from "./windows";

export interface WindowLink {
  kind: WindowKind;
  params: WindowParams;
}

const POSITIVE = /^[1-9]\d*$/;

// A link names a window by its id, `kind` or `kind:value`, so these are the
// kinds that take a value and how to read it back into params.
const PARAMS: Partial<Record<WindowKind, (value: string) => WindowParams | null>> = {
  team: (v) => (POSITIVE.test(v) ? { rosterId: Number(v) } : null),
  player: (v) => (/^[A-Za-z0-9]+$/.test(v) ? { playerId: v } : null),
  week: (v) => (POSITIVE.test(v) ? { week: Number(v) } : null),
  writeup: (v) => (POSITIVE.test(v) ? { week: Number(v) } : null),
};

// Kinds whose value may be left off: a bare `writeup` is the latest edition.
const OPTIONAL = new Set<WindowKind>(["writeup"]);

const isKind = (kind: string): kind is WindowKind => Object.hasOwn(REGISTRY, kind);

export function parseOpen(search: string): WindowLink[] {
  const list = new URLSearchParams(search).get("open");
  if (!list) return [];
  return list.split(",").flatMap((token) => {
    const [kind, value, ...rest] = token.split(":");
    if (!isKind(kind) || rest.length > 0) return [];
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
    const open = { type: "open", kind, params, size: { w: Math.min(w, vw), h: Math.min(h, vh - TASKBAR_HEIGHT) } } as const;
    const id = windowId(kind, params);
    const saved = base.find((s) => showing(s) === id);
    if (!saved || state.some((s) => s.id === saved.id || showing(s) === id)) return desktopReducer(state, open);
    return desktopReducer([...state, { ...saved, minimized: false, z: 0 }], { type: "focus", id: saved.id });
  }, []);
}
