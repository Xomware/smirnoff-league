import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function IceBottleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="0.5" width="3" height="2" className="fill-(--ice-deep)" />
      <path
        d="M6.5 2.5h3v2.5c0 1 2 1.5 2 3.5v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6c0-2 2-2.5 2-3.5z"
        className="fill-(--ice-glass) stroke-(--ice-deep)"
      />
      <rect x="4.5" y="8.5" width="7" height="3.5" className="fill-(--ice-label)" />
      <path d="M6 10.25h4" className="stroke-(--xp-text-inverse)" />
      <path d="M5.5 5.5v2" className="stroke-(--xp-text-inverse) opacity-80" />
    </Icon>
  );
}

export function IceCubeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.5l6 3v7l-6 3-6-3v-7z" className="fill-(--ice-glass) stroke-(--ice-deep)" />
      <path d="M2 4.5l6 3 6-3M8 7.5v7" className="fill-none stroke-(--ice-deep)" />
      <path d="M4 6.5v3" className="stroke-(--xp-text-inverse)" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 8L8 2l6.5 6" className="fill-none stroke-(--xp-red) stroke-2" />
      <path d="M3.5 7.5v7h9v-7" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <rect x="6.5" y="10" width="3" height="4.5" className="fill-(--xp-wood)" />
    </Icon>
  );
}

export function ScoresIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="9" className="fill-(--xp-screen) stroke-(--xp-text)" />
      <path d="M4 9V5h2v4M10 5h2v4h-2" className="fill-none stroke-(--xp-lime)" />
      <path d="M8 6v.5M8 8v.5" className="stroke-(--xp-lime)" />
      <path d="M5.5 14.5h5M8 11.5v3" className="stroke-(--xp-text)" />
    </Icon>
  );
}

export function StandingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="8.5" width="4" height="6" className="fill-(--xp-silver) stroke-(--xp-text)" />
      <rect x="5.5" y="4.5" width="5" height="10" className="fill-(--xp-gold) stroke-(--xp-text)" />
      <rect x="10.5" y="10.5" width="4" height="4" className="fill-(--xp-bronze) stroke-(--xp-text)" />
      <path d="M8 1l.9 1.7 1.8.3-1.3 1.2.3 1.8" className="fill-none stroke-(--xp-gold)" />
    </Icon>
  );
}

export function BracketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M1.5 2.5h4v4h-4M1.5 9.5h4v4h-4M5.5 4.5h3v7h-3M8.5 8h6"
        className="fill-none stroke-(--xp-text)"
      />
      <circle cx="14" cy="8" r="1.5" className="fill-(--xp-gold)" />
    </Icon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.5l6.5 12.5h-13z" className="fill-(--xp-gold) stroke-(--xp-text)" />
      <path d="M8 6v4.5M8 12v1" className="stroke-(--xp-text) stroke-[1.5]" />
    </Icon>
  );
}

export function MinimizeGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="10" width="6" height="2" className="fill-current" />
    </Icon>
  );
}

export function MaximizeGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 3.5h9v9h-9zM3.5 5h9" className="fill-none stroke-current stroke-[1.5]" />
    </Icon>
  );
}

export function CloseGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" className="stroke-current stroke-2" />
    </Icon>
  );
}
