"use client";

import { Component, type PointerEvent, type ReactNode, useLayoutEffect, useRef } from "react";

import { CloseGlyph, LinkGlyph, MaximizeGlyph, MinimizeGlyph, RestoreGlyph } from "@/components/xp/icons";
import { useAlerts } from "@/lib/alerts/alerts";
import { windowUrl } from "@/lib/desktop/deep-link";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { REGISTRY, windowTitle } from "@/lib/desktop/registry";
import { TASKBAR_HEIGHT, type WindowState } from "@/lib/desktop/windows";

const MIN_W = 240;
const MIN_H = 140;

interface Drag {
  mode: "move" | "resize";
  px: number;
  py: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// One window's render error must not take the whole desktop down with it.
// Closing and reopening the window remounts it and tries again.
class WindowBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <p role="alert">This window hit an error. Close it and open it again.</p>;
  }
}

interface DesktopWindowProps {
  win: WindowState;
}

export function DesktopWindow({ win }: DesktopWindowProps) {
  const { active, phone, dispatch } = useDesktop();
  const { notify } = useAlerts();
  const { Icon, component: Body } = REGISTRY[win.kind];
  const title = windowTitle(win);
  const { id } = win;
  const isActive = active?.id === id;
  const maximized = win.maximized || phone;
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const focusOnMount = useRef(isActive);

  // A layout effect, not a passive one: focusing dispatches a focus action,
  // and a deferred one could land after the user opens another window and
  // raise this one back over it.
  useLayoutEffect(() => {
    if (focusOnMount.current) ref.current?.focus({ preventScroll: true });
  }, []);

  const start = (mode: Drag["mode"], e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || maximized || (e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const vw = window.innerWidth;
    const vh = window.innerHeight - TASKBAR_HEIGHT;
    if (d.mode === "move") {
      dispatch({ type: "move", id, x: clamp(d.x + dx, 0, vw - d.w), y: clamp(d.y + dy, 0, vh - d.h) });
    } else {
      dispatch({ type: "resize", id, w: clamp(d.w + dx, MIN_W, vw - d.x), h: clamp(d.h + dy, MIN_H, vh - d.y) });
    }
  };

  const copyLink = async () => {
    const url = windowUrl(win);
    await navigator.clipboard.writeText(url);
    notify({ title: "Link copied", body: url, icon: "info" });
  };

  const end = () => {
    drag.current = null;
  };
  const dragHandlers = { onPointerMove, onPointerUp: end, onPointerCancel: end };

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      className="xp-window xp-desktop-window"
      data-active={isActive || undefined}
      data-maximized={maximized || undefined}
      hidden={win.minimized || (phone && !isActive)}
      style={maximized ? { zIndex: win.z } : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => dispatch({ type: "focus", id })}
      onFocus={() => dispatch({ type: "focus", id })}
    >
      <header
        className="xp-titlebar"
        onPointerDown={(e) => start("move", e)}
        onDoubleClick={() => !phone && dispatch({ type: "toggleMaximize", id })}
        {...dragHandlers}
      >
        <Icon />
        <h2 className="xp-titlebar-text">{title}</h2>
        <span className="xp-titlebar-controls">
          <button type="button" className="xp-control" aria-label="Copy link" title="Copy link" onClick={() => void copyLink()}>
            <LinkGlyph />
          </button>
          <button type="button" className="xp-control" aria-label="Minimize" onClick={() => dispatch({ type: "minimize", id })}>
            <MinimizeGlyph />
          </button>
          {!phone && (
            <button
              type="button"
              className="xp-control"
              aria-label={win.maximized ? "Restore" : "Maximize"}
              onClick={() => dispatch({ type: "toggleMaximize", id })}
            >
              {win.maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
            </button>
          )}
          <button
            type="button"
            className="xp-control xp-control-close"
            aria-label="Close"
            onClick={() => dispatch({ type: "close", id })}
          >
            <CloseGlyph />
          </button>
        </span>
      </header>
      <div className="xp-window-body">
        <WindowBoundary>
          <Body params={win.params} />
        </WindowBoundary>
      </div>
      {!maximized && <div className="xp-resize" aria-hidden onPointerDown={(e) => start("resize", e)} {...dragHandlers} />}
    </section>
  );
}
