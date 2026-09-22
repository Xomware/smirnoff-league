"use client";

import { createContext, type ReactNode, useContext } from "react";

export type DrillTarget =
  | { kind: "team"; rosterId: number }
  | { kind: "player"; playerId: string }
  | { kind: "week"; week: number };

// The window manager provides the real opener; outside it a click does nothing.
export const DrillContext = createContext<(to: DrillTarget) => void>(() => {});

interface DrillLinkProps {
  to: DrillTarget;
  children: ReactNode;
}

export function DrillLink({ to, children }: DrillLinkProps) {
  const onOpen = useContext(DrillContext);
  return (
    <button type="button" className="xp-drill" onClick={() => onOpen(to)}>
      {children}
    </button>
  );
}
