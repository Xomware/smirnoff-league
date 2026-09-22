import Image from "next/image";

import { IceBadge } from "./IceBadge";
import { StarIcon } from "./icons";

interface TeamNameProps {
  name: string;
  iced: boolean;
  ices: number;
  avatarUrl?: string | null;
  isMine?: boolean;
}

export function TeamName({ name, iced, ices, avatarUrl, isMine = false }: TeamNameProps) {
  const ice = iced ? " ice" : "";
  return (
    <span className="xp-team">
      <span className={`xp-avatar overflow-hidden${ice}`} aria-hidden>
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={28} height={28} className="size-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className={`xp-team-name${ice}`}>{name}</span>
      {isMine && <StarIcon className="shrink-0" role="img" aria-hidden={false} aria-label="Your team" />}
      <IceBadge count={ices} />
    </span>
  );
}
