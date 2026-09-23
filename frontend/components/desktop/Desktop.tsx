"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { DrillContext } from "@/components/views/drill-link";
import { openLinks, parseOpen, syncUrl } from "@/lib/desktop/deep-link";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { loadLayout, saveLayout } from "@/lib/desktop/persist";
import { REGISTRY, type WindowKind } from "@/lib/desktop/registry";
import { defaultLayout, type WindowParams, type WindowState } from "@/lib/desktop/windows";
import { useProfile } from "@/lib/profile/use-profile";
import { DesktopWindow } from "./DesktopWindow";
import { IconButton } from "./IconButton";

// The ice apps live in the Ices folder rather than on the desktop.
const ICONS: { kind: WindowKind; label: string; params?: WindowParams }[] = [
  { kind: "folder", label: "Ices", params: { id: "ices" } },
  { kind: "my-team", label: "My Team" },
  { kind: "scores", label: "Scores" },
  { kind: "standings", label: "Standings" },
  { kind: "brackets", label: "Brackets" },
  { kind: "news", label: "League News" },
  { kind: "recap", label: "Draft Recap" },
  { kind: "writeup", label: "News Drop" },
];

export function Desktop() {
  const { windows, open, active, dispatch } = useDesktop();
  const activeId = active?.id;
  const { me } = useProfile();
  const sub = me?.sub;
  const icons: typeof ICONS = me?.isAdmin ? [...ICONS, { kind: "admin", label: "Control Panel" }] : ICONS;
  const restored = useRef<WindowState[] | null>(null);
  const live = useRef(false);

  // Before paint, so the default layout never flashes up first.
  useLayoutEffect(() => {
    const { innerWidth: vw, innerHeight: vh } = window;
    const base = (sub && loadLayout(sub)) || defaultLayout(vw, vh);
    restored.current = openLinks(base, parseOpen(window.location.search), vw, vh);
    dispatch({ type: "restore", windows: restored.current });
  }, [sub, dispatch]);

  useEffect(() => {
    // The commit that dispatched the restore still holds the old layout, and
    // saving that would overwrite the user's.
    if (!live.current && windows !== restored.current) return;
    live.current = true;
    if (sub) saveLayout(sub, windows);
    syncUrl(windows);
  }, [windows, sub]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeId || !e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      // Option+Arrow moves by word in a text field on macOS.
      if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]")) return;
      // Otherwise the browser takes Alt+Left as its own Back and leaves the site.
      e.preventDefault();
      dispatch({ type: e.key === "ArrowLeft" ? "back" : "forward", id: activeId });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeId, dispatch]);

  return (
    <DrillContext.Provider value={({ kind, ...params }) => open(kind, params)}>
      <main className="xp-desktop">
        <ul className="xp-desktop-icons" aria-label="Desktop">
          {icons.map(({ kind, label, params }) => (
            <li key={kind}>
              <IconButton Icon={REGISTRY[kind].Icon} label={label} onOpen={() => open(kind, params)} />
            </li>
          ))}
        </ul>
        {windows.map((w) => (
          <DesktopWindow key={w.id} win={w} />
        ))}
        {/* CC BY-SA 3.0 requires credit for the wallpaper photo. */}
        <a
          className="xp-wallpaper-credit"
          href="https://commons.wikimedia.org/wiki/File:A_hill_covered_with_green_grass.jpg"
          target="_blank"
          rel="noreferrer"
        >
          Wallpaper: arifovic Jelic Zora, CC BY-SA 3.0
        </a>
      </main>
    </DrillContext.Provider>
  );
}
