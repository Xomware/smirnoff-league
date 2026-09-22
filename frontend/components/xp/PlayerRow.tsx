import { IceBadge } from "./IceBadge";

interface PlayerRowProps {
  name: string;
  position: string;
  points: number;
  iced: boolean;
  ices: number;
}

export function PlayerRow({ name, position, points, iced, ices }: PlayerRowProps) {
  return (
    <li className={`xp-player-row${iced ? " ice" : ""}`}>
      <span className="xp-player-pos">{position}</span>
      <span className="xp-player-name">{name}</span>
      <IceBadge count={ices} />
      <span className="xp-player-pts">{points.toFixed(2)}</span>
    </li>
  );
}
