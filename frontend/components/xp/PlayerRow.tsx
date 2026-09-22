import type { ReactNode } from "react";

import { IceBadge } from "./IceBadge";

interface PlayerRowProps {
  name: ReactNode;
  position: string;
  points: number;
  iced: boolean;
  ices: number;
  watch?: boolean;
  status?: ReactNode;
}

export function PlayerRow({ name, position, points, iced, ices, watch = false, status }: PlayerRowProps) {
  return (
    <li className={`xp-player-row${iced ? " ice" : ""}${watch ? " ice-watch" : ""}`}>
      <span className="xp-player-pos">{position}</span>
      <span className="xp-player-name">{name}</span>
      {status}
      <IceBadge count={ices} />
      <span className="xp-player-pts">{points.toFixed(2)}</span>
    </li>
  );
}
