import Image from "next/image";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

// Dom's pixel-art Smirnoff Ice bottle. It is 72x256, so it takes the requested
// height and only as much width as the bottle needs.
export function IceBottleIcon({ height = 16, className }: IconProps) {
  const h = Number(height);
  return (
    <Image
      src="/brand/ice-bottle-256.png"
      alt=""
      aria-hidden
      width={Math.max(1, Math.round((h * 72) / 256))}
      height={h}
      className={className}
      style={{ display: "inline-block" }}
    />
  );
}

// The robot head on its navy tile, 256x248: the app-button icon from the logo sheet.
export function RobotHeadIcon({ height = 16, className }: IconProps) {
  const h = Number(height);
  return (
    <Image
      src="/brand/robot-head.png"
      alt=""
      aria-hidden
      width={Math.round((h * 256) / 248)}
      height={h}
      className={className}
      style={{ display: "inline-block" }}
    />
  );
}

export function StopwatchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="0.5" width="3" height="1.5" className="fill-(--ice-deep)" />
      <circle cx="8" cy="9" r="6" className="fill-(--ice-tint) stroke-(--ice-deep)" />
      <path d="M8 9V5.5M8 9l2.5 1.5" className="fill-none stroke-(--xp-red) stroke-[1.5]" />
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

export function DesktopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="9" className="fill-(--xp-title-light) stroke-(--xp-text)" />
      <path d="M6 14.5h4M8 11.5v3" className="stroke-(--xp-text)" />
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

export function IceStandingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="9.5" width="4" height="5" className="fill-(--ice-tint) stroke-(--ice-deep)" />
      <rect x="5.5" y="5.5" width="5" height="9" className="fill-(--ice-frost) stroke-(--ice-deep)" />
      <rect x="10.5" y="11.5" width="4" height="3" className="fill-(--ice-glass) stroke-(--ice-deep)" />
      <path d="M8 .5l2.5 1.25v2.5L8 5.5 5.5 4.25v-2.5z" className="fill-(--ice-glass) stroke-(--ice-deep)" />
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

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M4 12.5v-4M7 12.5v-7M10 12.5v-3M13 12.5v-8" className="stroke-(--ice-deep) stroke-2" />
    </Icon>
  );
}

export function MediaPlayerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" className="fill-(--xp-title) stroke-(--xp-text)" />
      <path d="M6.5 5v6l5-3z" className="fill-(--xp-text-inverse)" />
    </Icon>
  );
}

// A folded broadsheet: masthead rule, a photo block and column lines.
export function NewspaperIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 2.5h11v10.5a1.5 1.5 0 0 1-1.5 1.5H2.5A1.5 1.5 0 0 1 1 13V5.5h2.5" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M3.5 2.5V13" className="stroke-(--xp-text)" />
      <path d="M5 4.5h8" className="stroke-(--smirnoff-red) stroke-[1.5]" />
      <rect x="5" y="6.5" width="3.5" height="3" className="fill-(--ice-frost)" />
      <path d="M10 7h3M10 9h3M5 11.5h8" className="stroke-(--xp-face-shadow)" />
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

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 1l2 4.5 4.8.5-3.6 3.2 1 4.8L8 11.5 3.8 14l1-4.8L1.2 6l4.8-.5z"
        className="fill-(--xp-gold) stroke-(--xp-text)"
      />
    </Icon>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="5" r="3" className="fill-(--ice-glass) stroke-(--ice-deep)" />
      <path d="M2.5 15c0-3.5 2.5-5.5 5.5-5.5s5.5 2 5.5 5.5z" className="fill-(--xp-select) stroke-(--ice-deep)" />
    </Icon>
  );
}

// XP's Control Panel: a window with two slider tracks.
export function ControlPanelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M1.5 4.5h13" className="stroke-(--xp-title) stroke-2" />
      <path d="M4 8h8M4 11.5h8" className="stroke-(--xp-face-shadow)" />
      <rect x="5" y="6.5" width="2" height="3" className="fill-(--xp-select)" />
      <rect x="9" y="10" width="2" height="3" className="fill-(--xp-start)" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="12" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M1.5 5.5h13" className="stroke-(--smirnoff-red) stroke-[3]" />
      <path d="M4.5 1v3M11.5 1v3" className="stroke-(--xp-text)" />
      <path d="M4 9h2M7 9h2M10 9h2M4 12h2M7 12h2" className="stroke-(--ice-deep)" />
    </Icon>
  );
}

export function ToiletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="1.5" width="5" height="6" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M2.5 7.5h11c0 3-2 4.5-4.5 4.5l1 2.5h-5l1-2.5c-2 0-3.5-1.5-3.5-4.5z" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M4.5 9h7" className="stroke-(--ice-frost) stroke-[1.5]" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" className="fill-(--xp-select) stroke-(--xp-frame)" />
      <path d="M8 7v4.5M8 4.5v1" className="stroke-(--xp-text-inverse) stroke-[1.5]" />
    </Icon>
  );
}

// Chug Videos: a camcorder with its red record light on.
export function CamcorderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="4.5" width="9.5" height="7.5" rx="1" className="fill-(--xp-silver) stroke-(--xp-text)" />
      <path d="M11 7l3.5-2v6.5L11 9.5z" className="fill-(--xp-face-shadow) stroke-(--xp-text)" />
      <circle cx="6" cy="8.25" r="2" className="fill-(--xp-screen) stroke-(--ice-deep)" />
      <circle cx="3.25" cy="6" r="0.9" className="fill-(--smirnoff-red)" />
    </Icon>
  );
}

// XP's yellow folder: the back panel with its tab, and the front flap leaning forward.
export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 2.5h4.5l1.5 1.5h7v9.5h-13z" className="fill-(--xp-folder-back) stroke-(--xp-folder-edge)" />
      <path d="M2.5 6h12.5l-1 7.5h-13z" className="fill-(--xp-folder) stroke-(--xp-folder-edge)" />
      <path d="M3.3 7h11" className="stroke-(--xp-folder-light)" />
    </Icon>
  );
}

// The League News feed: an Outlook Express inbox tray with a letter in it.
export function NewsFeedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="1.5" width="9" height="7" className="fill-(--xp-cream) stroke-(--xp-text)" />
      <path d="M3.5 1.5l4.5 4 4.5-4" className="fill-none stroke-(--xp-text)" />
      <path d="M1.5 8.5h3.5l1 2h4l1-2h3.5v5h-13z" className="fill-(--xp-title-light) stroke-(--xp-frame)" />
    </Icon>
  );
}

// Waiver or free-agent move: a player in, a player out.
export function RosterMoveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" className="fill-(--xp-cream) stroke-(--xp-face-shadow)" />
      <path d="M5 1.5v5M2.5 4h5" className="stroke-(--xp-start-dark) stroke-2" />
      <path d="M8.5 12h5" className="stroke-(--xp-red) stroke-2" />
    </Icon>
  );
}

export function TradeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 5.5h10.5V3l3 3.5-3 3.5V7.5H1.5z" className="fill-(--xp-title-light) stroke-(--xp-frame)" strokeWidth="0.75" />
      <path d="M14.5 10.5H4V8l-3 3.5L4 15v-2.5h10.5z" className="fill-(--xp-gold) stroke-(--xp-wood)" strokeWidth="0.75" />
    </Icon>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" className="fill-(--xp-red) stroke-(--xp-close-dark)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" className="stroke-(--xp-text-inverse) stroke-[1.5]" />
    </Icon>
  );
}

export function SpeakerIcon({ muted, ...props }: IconProps & { muted: boolean }) {
  return (
    <Icon {...props}>
      <path d="M2 6h2.5L8 3v10l-3.5-3H2z" className="fill-(--xp-cream) stroke-(--xp-text)" />
      {muted ? (
        <path d="M10 6l4 4M14 6l-4 4" className="stroke-(--xp-red) stroke-[1.5]" />
      ) : (
        <path d="M10 6a3 3 0 0 1 0 4M11.5 4.5a5 5 0 0 1 0 7" className="fill-none stroke-(--xp-cream)" />
      )}
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.5a1 1 0 0 1 1 1v.6a4.5 4.5 0 0 1 3.5 4.4v3l1.5 2v.5H2v-.5l1.5-2v-3A4.5 4.5 0 0 1 7 3.1v-.6a1 1 0 0 1 1-1z" className="fill-(--xp-gold) stroke-(--xp-text)" />
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" className="fill-(--xp-wood) stroke-(--xp-text)" />
      <path d="M5 6.5a3 3 0 0 1 1.5-2" className="fill-none stroke-(--xp-cream)" />
    </Icon>
  );
}

export const ALERT_ICONS = {
  ice: IceBottleIcon,
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

export type AlertIconName = keyof typeof ALERT_ICONS;

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

export function LinkGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6.5 9.5l3-3M7.5 5l1.25-1.25a2.5 2.5 0 0 1 3.5 3.5L11 8.5M8.5 11l-1.25 1.25a2.5 2.5 0 0 1-3.5-3.5L5 7.5"
        className="fill-none stroke-current stroke-[1.5]"
      />
    </Icon>
  );
}

export function RestoreGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 3.5h7v7M3.5 5.5h7v7h-7z" className="fill-none stroke-current stroke-[1.5]" />
    </Icon>
  );
}

function NavArrow({ d, ...props }: IconProps & { d: string }) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="7" className="fill-(--xp-start) stroke-(--xp-start-dark)" />
      <path d="M4 5.5a5 4 0 0 1 8 0" className="fill-none stroke-(--xp-start-light) stroke-2 opacity-70" />
      <path d={d} className="fill-(--xp-text-inverse)" />
    </Icon>
  );
}

export function BackArrowIcon(props: IconProps) {
  return <NavArrow d="M3.5 8L7.5 4.5v2h5v3h-5v2z" {...props} />;
}

export function ForwardArrowIcon(props: IconProps) {
  return <NavArrow d="M12.5 8L8.5 4.5v2h-5v3h5v2z" {...props} />;
}
