import type { ComponentType, SVGProps } from "react";

import { TrophyIcon } from "@/components/xp/icons";
import type { AwardId } from "@/lib/awards/awards";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

function BlowoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 .5l1.6 3.9 3.9-1.6-1.6 3.9 3.6 1.3-3.6 1.3 1.6 3.9-3.9-1.6L8 15.5l-1.6-3.9-3.9 1.6 1.6-3.9L.5 8l3.6-1.3-1.6-3.9 3.9 1.6z" className="fill-(--xp-red) stroke-(--xp-close-dark)" />
      <circle cx="8" cy="8" r="2.5" className="fill-(--xp-gold)" />
    </Icon>
  );
}

function EscapeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1l6 2v4.5c0 3.5-2.6 6.2-6 7.5-3.4-1.3-6-4-6-7.5V3z" className="fill-(--ice-tint) stroke-(--ice-deep)" />
      <path d="M5 8l2 2 4-4.5" className="fill-none stroke-(--xp-hill) stroke-[1.75]" />
    </Icon>
  );
}

function Bench({ children, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1" y="9.5" width="14" height="2" className="fill-(--xp-wood)" />
      <path d="M3 11.5v3.5M13 11.5v3.5" className="stroke-(--xp-wood) stroke-[1.5]" />
      {children}
    </Icon>
  );
}

function ChokeIcon(props: IconProps) {
  return (
    <Bench {...props}>
      <path d="M8 .5v6M5 4l3 3 3-3" className="fill-none stroke-(--xp-red) stroke-[1.75]" />
    </Bench>
  );
}

function BenchHeroIcon(props: IconProps) {
  return (
    <Bench {...props}>
      <path d="M8 .5l1.8 3.6 3.9.5-2.9 2.6.8 3.8H4.4l.8-3.8L2.3 4.6l3.9-.5z" className="fill-(--xp-gold) stroke-(--xp-wood)" />
    </Bench>
  );
}

function FastestChugIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1 5.5h4M.5 8h4M1 10.5h4" className="stroke-(--ice-deep)" />
      <path d="M10 .5h2v3l1.5 2.5v9h-5V6L10 3.5z" className="fill-(--ice-frost) stroke-(--ice-deep)" />
      <rect x="8.5" y="8" width="5" height="3" className="fill-(--smirnoff-red)" />
    </Icon>
  );
}

function IceKingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 5l3.5 3L8 2.5 11 8l3.5-3-1.5 8.5H3z" className="fill-(--ice-frost) stroke-(--ice-deep)" />
      <path d="M3 13.5h10" className="stroke-(--xp-gold) stroke-2" />
      <circle cx="8" cy="9.5" r="1.25" className="fill-(--smirnoff-red)" />
    </Icon>
  );
}

export const AWARD_ICONS: Record<AwardId, ComponentType<IconProps>> = {
  "top-score": TrophyIcon,
  blowout: BlowoutIcon,
  escape: EscapeIcon,
  choke: ChokeIcon,
  "bench-hero": BenchHeroIcon,
  "fastest-chug": FastestChugIcon,
  "ice-king": IceKingIcon,
};
