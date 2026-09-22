import { IceBadge } from "./IceBadge";

interface TeamNameProps {
  name: string;
  iced: boolean;
  ices: number;
}

export function TeamName({ name, iced, ices }: TeamNameProps) {
  const ice = iced ? " ice" : "";
  return (
    <span className="xp-team">
      <span className={`xp-avatar${ice}`} aria-hidden>
        {name.charAt(0).toUpperCase()}
      </span>
      <span className={`xp-team-name${ice}`}>{name}</span>
      <IceBadge count={ices} />
    </span>
  );
}
