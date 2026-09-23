"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useReducer,
} from "react";

import { REGISTRY, type WindowKind } from "./registry";
import {
  activeWindow,
  defaultLayout,
  desktopReducer,
  TASKBAR_HEIGHT,
  type WindowAction,
  type WindowParams,
  type WindowState,
} from "./windows";

interface Desktop {
  windows: WindowState[];
  active: WindowState | undefined;
  dispatch: Dispatch<WindowAction>;
  open: (kind: WindowKind, params?: WindowParams) => void;
}

const DesktopContext = createContext<Desktop | null>(null);

// The prerender has no viewport; the desktop only renders once a user is
// signed in on the client, so the server's empty list is never shown.
function initialWindows(): WindowState[] {
  return typeof window === "undefined" ? [] : defaultLayout(window.innerWidth, window.innerHeight);
}

export function DesktopProvider({ children }: { children: ReactNode }) {
  const [windows, dispatch] = useReducer(desktopReducer, undefined, initialWindows);

  const open = useCallback((kind: WindowKind, params: WindowParams = {}) => {
    const { w, h } = REGISTRY[kind].defaultSize;
    const size = { w: Math.min(w, window.innerWidth), h: Math.min(h, window.innerHeight - TASKBAR_HEIGHT) };
    dispatch({ type: "open", kind, params, size });
  }, []);

  return (
    <DesktopContext value={{ windows, active: activeWindow(windows), dispatch, open }}>
      {children}
    </DesktopContext>
  );
}

export function useDesktop(): Desktop {
  const desktop = useContext(DesktopContext);
  if (!desktop) throw new Error("useDesktop needs a DesktopProvider");
  return desktop;
}
