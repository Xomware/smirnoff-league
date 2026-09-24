import Image from "next/image";

import type { Trouble } from "@/lib/ices/trouble";
import { useTrouble } from "@/lib/ices/use-trouble";
import { IceBadge } from "./IceBadge";
import { StarIcon } from "./icons";

interface TeamNameProps {
  name: string;
  iced: boolean;
  ices: number;
  avatarUrl?: string | null;
  isMine?: boolean;
  season?: boolean;
  // A phone board shows the badges on its own sub line, where they have room.
  badges?: boolean;
}

const TROUBLE_LABEL: Record<Trouble, string> = { late: "Late", owe: "Owes", lowest: "Lowest" };

// Words beside the red, so the state never rests on colour alone.
export function TroubleTags({ trouble }: { trouble: Trouble[] }) {
  return trouble.map((t) => (
    <span key={t} className="trouble-tag" data-trouble={t}>
      {TROUBLE_LABEL[t]}
    </span>
  ));
}

export function TeamName({ name, iced, ices, avatarUrl, isMine = false, season = false, badges = true }: TeamNameProps) {
  const trouble = useTrouble().byName(name);
  const ice = iced ? " ice" : "";
  return (
    <span className="xp-team" data-trouble={trouble.join(" ") || undefined}>
      <span className={`xp-avatar overflow-hidden${ice}`} aria-hidden>
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={28} height={28} className="size-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className={`xp-team-name${ice}`}>{name}</span>
      {isMine && <StarIcon className="shrink-0" role="img" aria-hidden={false} aria-label="Your team" />}
      {badges && (
        <>
          <IceBadge count={ices} season={season} />
          <TroubleTags trouble={trouble} />
        </>
      )}
    </span>
  );
}
