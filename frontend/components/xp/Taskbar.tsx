"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/lib/auth/use-auth";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { REGISTRY, useWindowTitle } from "@/lib/desktop/registry";
import { useProfile } from "@/lib/profile/use-profile";
import { IceBottleIcon } from "./icons";
import { SpeakerToggle } from "./SpeakerToggle";
import { StartMenu } from "./StartMenu";

function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

function readClock() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The static export prerenders with no clock, so the server snapshot is empty
// and the time appears on hydration instead of mismatching.
function readServerClock() {
  return "";
}

export function Taskbar() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { setEditing } = useProfile();
  const { windows, active, dispatch, open: openWindow } = useDesktop();
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const time = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  const windowTitle = useWindowTitle();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      start.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root}>
      {open && (
        <StartMenu
          id={menuId}
          onOpen={(kind) => {
            setOpen(false);
            openWindow(kind);
          }}
          onEditProfile={() => {
            setOpen(false);
            setEditing(true);
          }}
          onSignOut={() => void signOut()}
        />
      )}
      <div className="xp-taskbar">
        <button
          ref={start}
          type="button"
          className="xp-start"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <IceBottleIcon width={20} height={20} />
          start
        </button>
        <ul className="xp-tasks" aria-label="Open windows">
          {windows.map((w) => {
            const { Icon } = REGISTRY[w.kind];
            const title = windowTitle(w);
            const pressed = active?.id === w.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className="xp-task"
                  aria-pressed={pressed}
                  onClick={() => dispatch({ type: pressed ? "minimize" : "focus", id: w.id })}
                >
                  <Icon className="shrink-0" />
                  <span className="truncate max-md:sr-only">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="xp-tray">
          <SpeakerToggle />
          <time>{time}</time>
        </div>
      </div>
    </div>
  );
}
