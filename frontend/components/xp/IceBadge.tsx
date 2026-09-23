import { IceBottleIcon } from "./icons";

interface IceBadgeProps {
  count: number;
  season?: boolean;
}

// Beside a game or week the count is that week's ices; season totals say so.
export function IceBadge({ count, season = false }: IceBadgeProps) {
  if (count <= 0) return null;
  return (
    <span className="ice-badge">
      <IceBottleIcon />
      <span aria-hidden>x{count}</span>
      {season && (
        <span aria-hidden className="ice-badge-season">
          season
        </span>
      )}
      <span className="sr-only">
        {count} {count === 1 ? "ice" : "ices"} this {season ? "season" : "week"}
      </span>
    </span>
  );
}
