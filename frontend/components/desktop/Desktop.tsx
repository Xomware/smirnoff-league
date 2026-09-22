"use client";

import { useEffect } from "react";

import { DrillContext } from "@/components/views/drill-link";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { REGISTRY, type WindowKind } from "@/lib/desktop/registry";
import { DesktopWindow } from "./DesktopWindow";

const ICONS: { kind: WindowKind; label: string }[] = [
  { kind: "scores", label: "Scores" },
  { kind: "standings", label: "Standings" },
  { kind: "brackets", label: "Brackets" },
  { kind: "ices", label: "Ice Ledger" },
  { kind: "watch", label: "Ice Watch" },
  { kind: "stats", label: "Ice Stats" },
  { kind: "ice-standings", label: "Ice Standings" },
  { kind: "recap", label: "Draft Recap" },
];

export function Desktop() {
  const { windows, open, active, dispatch } = useDesktop();
  const activeId = active?.id;

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
