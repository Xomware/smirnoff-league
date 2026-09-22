import { IceBottleIcon } from "./icons";

interface IceBadgeProps {
  count: number;
}

export function IceBadge({ count }: IceBadgeProps) {
  if (count <= 0) return null;
  return (
    <span className="ice-badge">
      <IceBottleIcon />
      <span aria-hidden>x{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? "ice" : "ices"} owed
      </span>
    </span>
  );
}
