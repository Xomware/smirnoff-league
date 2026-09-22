"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { DrillContext } from "@/components/views/drill-link";
import { openLinks, parseOpen, syncUrl } from "@/lib/desktop/deep-link";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { loadLayout, saveLayout } from "@/lib/desktop/persist";
import { REGISTRY, type WindowKind } from "@/lib/desktop/registry";
import { defaultLayout, type WindowState } from "@/lib/desktop/windows";
import { useProfile } from "@/lib/profile/use-profile";
import { DesktopWindow } from "./DesktopWindow";

const ICONS: { kind: WindowKind; label: string }[] = [
  { kind: "scores", label: "Scores" },
  { kind: "standings", label: "Standings" },
  { kind: "brackets", label: "Brackets" },
  { kind: "ices", label: "Ice Ledger" },
  { kind: "stats", label: "Ice Stats" },
  { kind: "recap", label: "Draft Recap" },
];

export function Desktop() {
  const { windows, dispatch, open } = useDesktop();
  const sub = useProfile().me?.sub;
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

  return (
    <DrillContext.Provider value={({ kind, ...params }) => open(kind, params)}>
      <main className="xp-desktop">
        <ul className="xp-desktop-icons" aria-label="Desktop">
          {ICONS.map(({ kind, label }) => {
            const { Icon } = REGISTRY[kind];
            return (
              <li key={kind}>
                {/* Double-click with a mouse, as on XP. A click with detail 0 is Enter,
                    Space or a screen reader, and a touch gets no double-click at all. */}
                <button
                  type="button"
                  className="xp-desktop-icon"
                  onDoubleClick={() => open(kind)}
                  onClick={(e) => e.detail === 0 && open(kind)}
                  onPointerUp={(e) => e.pointerType === "touch" && open(kind)}
                >
                  <Icon width={40} height={40} />
                  <span className="xp-desktop-icon-label">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {windows.map((w) => (
          <DesktopWindow key={w.id} win={w} />
        ))}
      </main>
    </DrillContext.Provider>
  );
}
