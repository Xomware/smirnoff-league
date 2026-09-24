"use client";

import { createContext, type MouseEvent, type ReactNode, useContext } from "react";

import type { AdminPanel } from "@/components/admin/ControlPanel";
import type { WindowParams } from "@/lib/desktop/windows";

export type DrillTarget =
  | { kind: "team"; rosterId: number }
  | { kind: "player"; playerId: string }
  | { kind: "week"; week: number }
  | { kind: "game"; week: number; matchup: number }
  | { kind: "news" }
  | { kind: "ices-overview" | "ices" | "ice-standings" | "chug-rankings" | "stats" | "watch" | "videos" | "scores" | "standings" | "brackets" | "recap" }
  | { kind: "admin" }
  | { kind: "admin"; panel: AdminPanel }
  | { kind: "writeup"; week: number }
  | { kind: "awards"; week?: number };

// The window manager provides the real opener; outside it a click does nothing.
export const DrillContext = createContext<(to: DrillTarget) => void>(() => {});

// Set by the window a link sits in. Outside any window it is null and every
// drill opens a new window.
export const NavigateContext = createContext<((to: DrillTarget) => void) | null>(null);

// Set by the window or page a view sits in, so a picked tab or filter lands in
// the view's params and its link without a history step. Outside one it is null.
export const ViewParamsContext = createContext<((params: WindowParams) => void) | null>(null);

interface DrillLinkProps {
  to: DrillTarget;
  children: ReactNode;
}

export function DrillLink({ to, children }: DrillLinkProps) {
  const onOpen = useContext(DrillContext);
  const navigate = useContext(NavigateContext);
  const onClick = (e: MouseEvent) => (navigate && !e.ctrlKey && !e.metaKey ? navigate(to) : onOpen(to));
  return (
    <button type="button" className="xp-drill" onClick={onClick} onAuxClick={(e) => e.button === 1 && onOpen(to)}>
      {children}
    </button>
  );
}
