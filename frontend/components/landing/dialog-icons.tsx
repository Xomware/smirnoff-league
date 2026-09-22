import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="16" cy="16" r="14" className="fill-(--xp-close) stroke-(--xp-close-dark) stroke-2" />
      <path d="M10.5 10.5l11 11M21.5 10.5l-11 11" className="stroke-(--xp-text-inverse) stroke-[3.5]" />
    </Icon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 3l14 25H2z" className="fill-(--xp-gold) stroke-(--xp-text) stroke-[1.5]" />
      <path d="M16 11v9" className="stroke-(--xp-text) stroke-[3.5]" />
      <circle cx="16" cy="24" r="1.8" className="fill-(--xp-text)" />
    </Icon>
  );
}

export function EnvelopeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="26" height="18" className="fill-(--xp-cream) stroke-(--xp-text) stroke-[1.5]" />
      <path d="M3 7l13 10L29 7" className="fill-none stroke-(--xp-text) stroke-[1.5]" />
      <circle cx="26" cy="8" r="5" className="fill-(--xp-close)" />
    </Icon>
  );
}
