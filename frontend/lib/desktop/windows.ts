import type { WindowKind } from "./registry";

export type WindowParams = Record<string, string | number>;

export interface WindowView {
  kind: WindowKind;
  params: WindowParams;
}

export interface WindowState {
  id: string;
  kind: WindowKind;
  params: WindowParams;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  // Absent until the window first navigates; see historyOf.
  history?: { views: WindowView[]; at: number };
}

export type WindowAction =
  | { type: "open"; kind: WindowKind; params: WindowParams; size: { w: number; h: number } }
  | { type: "close" | "focus" | "minimize" | "toggleMaximize"; id: string }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; w: number; h: number }
  | { type: "navigate"; id: string; kind: WindowKind; params: WindowParams }
  | { type: "retab"; id: string; tab: string }
  | { type: "back" | "forward"; id: string }
  | { type: "restore"; windows: WindowState[] };

// Matches --taskbar-height; windows live in the viewport above it.
export const TASKBAR_HEIGHT = 44;
// Tall enough for the week's ices and who owes, without scrolling.
export const HOME_H = 420;
// Desktop icons take the left edge, so new windows open clear of them.
const ICON_COLUMN = 112;

// Phone-only screens share the shape, hence a plain string kind. A game is
// read as a week then a matchup, which key order alone would reverse.
export function windowId(kind: string, params: WindowParams): string {
  if (kind === "game") return `game:${params.week}-${params.matchup}`;
  return [kind, ...Object.keys(params).sort().map((k) => params[k])].join(":");
}

// A view's inner tab is in its link but not its identity, so switching tabs
// neither remounts the view nor stops a link to the view finding it.
export const viewKey = (kind: string, params: WindowParams) =>
  windowId(kind, Object.fromEntries(Object.entries(params).filter(([k]) => k !== "tab")));

export function activeWindow(state: WindowState[]): WindowState | undefined {
  return state.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
}

export function historyOf(w: WindowState): { views: WindowView[]; at: number } {
  return w.history ?? { views: [{ kind: w.kind, params: w.params }], at: 0 };
}

const topZ = (state: WindowState[]) => Math.max(0, ...state.map((w) => w.z));

function update(state: WindowState[], id: string, patch: Partial<WindowState>): WindowState[] {
  return state.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

function go(state: WindowState[], id: string, step: number): WindowState[] {
  const w = state.find((w) => w.id === id);
  if (!w) return state;
  const { views, at } = historyOf(w);
  const view = views[at + step];
  if (!view) return state;
  return update(state, id, { ...view, history: { views, at: at + step } });
}

export function desktopReducer(state: WindowState[], action: WindowAction): WindowState[] {
  switch (action.type) {
    case "open": {
      const base = windowId(action.kind, action.params);
      // A window keeps its id when it navigates, so match on what it shows now.
      const showing = state.find((w) => viewKey(w.kind, w.params) === viewKey(action.kind, action.params));
      if (showing) return desktopReducer(state, { type: "focus", id: showing.id });
      let id = base;
      for (let n = 2; state.some((w) => w.id === id); n++) id = `${base}#${n}`;
      const step = 32 * (state.length % 6);
      const { kind, params, size } = action;
      const opened = { id, kind, params, ...size, x: ICON_COLUMN + 48 + step, y: 16 + step };
      return [...state, { ...opened, z: topZ(state) + 1, minimized: false, maximized: false }];
    }
    case "close":
      return state.filter((w) => w.id !== action.id);
    case "focus":
      if (activeWindow(state)?.id === action.id) return state;
      return update(state, action.id, { z: topZ(state) + 1, minimized: false });
    case "minimize":
      return update(state, action.id, { minimized: true });
    case "toggleMaximize": {
      const w = state.find((w) => w.id === action.id);
      if (!w) return state;
      return update(desktopReducer(state, { type: "focus", id: w.id }), w.id, { maximized: !w.maximized });
    }
    case "move":
      return update(state, action.id, { x: action.x, y: action.y });
    case "resize":
      return update(state, action.id, { w: action.w, h: action.h });
    case "navigate": {
      const w = state.find((w) => w.id === action.id);
      if (!w) return state;
      const { views, at } = historyOf(w);
      const view = { kind: action.kind, params: action.params };
      return update(state, w.id, { ...view, history: { views: [...views.slice(0, at + 1), view], at: at + 1 } });
    }
    case "retab": {
      const w = state.find((w) => w.id === action.id);
      if (!w) return state;
      const { views, at } = historyOf(w);
      const params = { ...w.params, tab: action.tab };
      return update(state, w.id, { params, history: { views: views.map((v, i) => (i === at ? { kind: w.kind, params } : v)), at } });
    }
    case "back":
      return go(state, action.id, -1);
    case "forward":
      return go(state, action.id, 1);
    case "restore":
      return action.windows;
  }
}

// The mockup's arrangement, ice-first: the league summary top-left with the
// latest News Drop under it, Ice Standings down the right where League
// Standings sat, and the draft recap minimized to the taskbar.
export function defaultLayout(vw: number, vh: number): WindowState[] {
  const gap = 16;
  const height = vh - TASKBAR_HEIGHT;
  const mainW = Math.max(320, Math.min(680, Math.round((vw - ICON_COLUMN) * 0.52)));
  const sideX = ICON_COLUMN + mainW + gap * 2;
  const sideW = Math.max(280, Math.min(640, vw - sideX - gap));
  const lowerY = gap * 2 + HOME_H;
  const rects: [WindowKind, number, number, number, number, number][] = [
    ["home", ICON_COLUMN + gap, gap, mainW, HOME_H, 4],
    ["writeup", ICON_COLUMN + gap, lowerY, mainW, Math.max(240, height - lowerY - gap), 2],
    ["ice-standings", sideX, gap, sideW, height - gap * 2, 3],
    ["recap", ICON_COLUMN + gap * 3, gap * 3, mainW, Math.round((mainW * 9) / 16) + 40, 1],
  ];
  return rects.map(([kind, x, y, w, h, z]) => ({
    id: kind,
    kind,
    params: {},
    x,
    y,
    w,
    h,
    z,
    minimized: kind === "recap",
    maximized: false,
  }));
}
