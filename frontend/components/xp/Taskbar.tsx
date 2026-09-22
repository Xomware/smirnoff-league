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
  const [menu, setMenu] = useState<"start" | "windows" | null>(null);
  const { signOut } = useAuth();
  const { setEditing } = useProfile();
  const { windows, active, phone, dispatch, open: openWindow } = useDesktop();
  const menuId = useId();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const windowsButton = useRef<HTMLButtonElement>(null);
  const time = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  const windowTitle = useWindowTitle();

  useEffect(() => {
    if (!menu) return;
    const opener = menu === "start" ? start : windowsButton;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(null);
      opener.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menu]);

  const toggle = (which: "start" | "windows") => setMenu((m) => (m === which ? null : which));

  return (
    <div ref={root}>
      {menu === "start" && (
        <StartMenu
          id={menuId}
          onOpen={(kind) => {
            setMenu(null);
            openWindow(kind);
          }}
          onEditProfile={() => {
            setMenu(null);
            setEditing(true);
          }}
          onSignOut={() => void signOut()}
        />
      )}
      {menu === "windows" && (
        <ul id={listId} className="xp-window-list" aria-label="Open windows">
          {windows.map((w) => {
            const { Icon } = REGISTRY[w.kind];
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className="xp-start-menu-link w-full"
                  aria-pressed={active?.id === w.id}
                  onClick={() => {
                    setMenu(null);
                    dispatch({ type: "focus", id: w.id });
                  }}
                >
                  <Icon width={24} height={24} className="shrink-0" />
                  <span className="truncate">{windowTitle(w)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="xp-taskbar">
        <button
          ref={start}
          type="button"
          className="xp-start"
          aria-expanded={menu === "start"}
          aria-controls={menu === "start" ? menuId : undefined}
          onClick={() => toggle("start")}
        >
          <IceBottleIcon width={20} height={20} />
          start
        </button>
        {/* A phone has room for about three icon-only tabs, and team and player
            windows share an icon, so the tabs become one list with titles. */}
        {phone ? (
          <div className="xp-tasks">
            {windows.length > 0 && (
              <button
                ref={windowsButton}
                type="button"
                className="xp-task xp-task-count"
                aria-expanded={menu === "windows"}
                aria-controls={menu === "windows" ? listId : undefined}
                onClick={() => toggle("windows")}
              >
                {windows.length} {windows.length === 1 ? "window" : "windows"}
              </button>
            )}
          </div>
        ) : (
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
                    <span className="truncate">{title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="xp-tray">
          <SpeakerToggle />
          <time>{time}</time>
        </div>
      </div>
    </div>
  );
}
