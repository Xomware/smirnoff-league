import type { ComponentType, SVGProps } from "react";

import { StopwatchIcon } from "@/components/xp/icons";
import type { ReactionType } from "@/lib/api/social";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function GlacierIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M0.5 14.5L5.5 3.5l3 5 2-3 5 9z" className="fill-(--ice-tint) stroke-(--ice-deep)" />
      <path d="M5.5 3.5L3.9 7l1.6-0.8L7 7.2zM10.5 5.5l-1 1.6 1-0.4 1 0.6z" className="fill-(--xp-cream) stroke-(--ice-deep) stroke-[0.75]" />
    </Icon>
  );
}

export function BottleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 0.5h3v4l1.5 2.5v8.5h-6V7l1.5-2.5z" className="fill-(--ice-glass) stroke-(--ice-deep)" />
      <rect x="5" y="8.5" width="6" height="4" className="fill-(--xp-red)" />
      <rect x="6.5" y="0.5" width="3" height="1.5" className="fill-(--xp-silver) stroke-(--ice-deep)" />
    </Icon>
  );
}

export function SirenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12.5V9a3.5 3.5 0 0 1 7 0v3.5z" className="fill-(--xp-red) stroke-(--xp-text)" />
      <rect x="2.5" y="12.5" width="11" height="3" className="fill-(--xp-silver) stroke-(--xp-text)" />
      <path d="M8 0.5v2.5M1.5 3.5l1.8 1.8M14.5 3.5l-1.8 1.8" className="fill-none stroke-(--xp-red) stroke-[1.5]" />
      <path d="M6.5 8.5a1.5 1.5 0 0 1 1.5-1.5" className="fill-none stroke-(--xp-cream)" />
    </Icon>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 12V4.5l3.5 3.5 3-5.5 3 5.5 3.5-3.5V12z" className="fill-(--xp-gold) stroke-(--xp-wood)" />
      <rect x="1.5" y="12" width="13" height="2.5" className="fill-(--xp-gold) stroke-(--xp-wood)" />
      <circle cx="8" cy="9" r="1.1" className="fill-(--xp-red)" />
    </Icon>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 2.5h13v8.5h-7l-3.5 3v-3H1.5z" className="fill-(--xp-cream) stroke-(--ice-deep)" />
      <path d="M4 5.5h8M4 8h5" className="fill-none stroke-(--ice-deep)" />
    </Icon>
  );
}

export const REACTION_ICONS: Record<ReactionType, ComponentType<IconProps>> = {
  glacier: GlacierIcon,
  stopwatch: StopwatchIcon,
  bottle: BottleIcon,
  siren: SirenIcon,
  crown: CrownIcon,
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  glacier: "Ice cold",
  stopwatch: "Fast chug",
  bottle: "Bottoms up",
  siren: "Alert",
  crown: "Chug king",
};
