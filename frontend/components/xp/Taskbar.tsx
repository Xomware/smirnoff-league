"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { DueWarning } from "@/components/home/DueWarning";
import { useAuth } from "@/lib/auth/use-auth";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { REGISTRY, useWindowTitle } from "@/lib/desktop/registry";
import { defaultLayout } from "@/lib/desktop/windows";
import { useNotifications } from "@/lib/notifications/use-notifications";
import { useProfile } from "@/lib/profile/use-profile";
import { SnowflakeGlyph } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/lib/theme/theme";
import { RobotHeadIcon } from "./icons";
import { NotificationBell } from "./NotificationBell";
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
  const { unread } = useNotifications();
  const { setTheme, switching } = useTheme();

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
          onReset={() => {
            setOpen(false);
            dispatch({ type: "restore", windows: defaultLayout(window.innerWidth, window.innerHeight) });
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
          <RobotHeadIcon width={22} height={22} />
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
                  <span className="truncate">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="xp-tray">
          <DueWarning />
          <NotificationBell
            onOpen={() => {
              // Open would only focus a window already showing, and marking seen happens on mount.
              const shown = windows.find((w) => w.kind === "notifications");
              if (shown && unread) dispatch({ type: "close", id: shown.id });
              openWindow("notifications");
            }}
          />
          <SpeakerToggle />
          <button
            type="button"
            className="xp-tray-button"
            aria-label="Switch to the Glacier theme"
            title="Glacier theme"
            disabled={switching}
            onClick={() => setTheme("glacier")}
          >
            <SnowflakeGlyph width={18} height={18} />
          </button>
          <time>{time}</time>
        </div>
      </div>
    </div>
  );
}
