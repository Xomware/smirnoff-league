import { useState } from "react";

import { ICE_APPS } from "@/lib/desktop/ice-apps";
import type { WindowKind } from "@/lib/desktop/registry";
import { useProfile } from "@/lib/profile/use-profile";
import {
  BracketIcon,
  ControlPanelIcon,
  DesktopIcon,
  FolderIcon,
  HomeIcon,
  NewsFeedIcon,
  NewspaperIcon,
  ProfileIcon,
  RobotHeadIcon,
  ScoresIcon,
  StandingsIcon,
  StarIcon,
} from "./icons";

const ITEMS = [
  { kind: "home", label: "Home", Icon: HomeIcon },
  { kind: "my-team", label: "My Team", Icon: StarIcon },
  { kind: "scores", label: "Scores", Icon: ScoresIcon },
  { kind: "standings", label: "Standings", Icon: StandingsIcon },
  { kind: "brackets", label: "Brackets", Icon: BracketIcon },
  { kind: "news", label: "League News", Icon: NewsFeedIcon },
  { kind: "writeup", label: "News Drop", Icon: NewspaperIcon },
] as const;

interface IcesSubmenuProps {
  onOpen: (kind: WindowKind) => void;
}

// XP's cascading menu: it opens on mouse hover, or on a click or tap. Only the
// keyboard toggles it shut, since a mouse click always follows a hover and a
// tap's pointerleave fires the moment the finger lifts. The flyout is
// fixed-position so the menu's scrolling list doesn't clip it, and it grows up
// from the Ices row so it never runs under the taskbar.
function IcesSubmenu({ onOpen }: IcesSubmenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const show = (row: Element) => setAnchor(row.getBoundingClientRect());

  return (
    <li
      onPointerEnter={(e) => e.pointerType === "mouse" && show(e.currentTarget)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setAnchor(null)}
    >
      <button
        type="button"
        className="xp-start-menu-link w-full"
        aria-expanded={anchor !== null}
        onClick={(e) => (e.detail === 0 && anchor ? setAnchor(null) : show(e.currentTarget))}
      >
        <FolderIcon width={24} height={24} />
        Ices
        <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden focusable="false" className="ml-auto">
          <path d="M2 0l4 4-4 4z" className="fill-current" />
        </svg>
      </button>
      {anchor && (
        <ul
          aria-label="Ices"
          className="xp-start-submenu"
          style={{ left: anchor.right, bottom: Math.max(0, window.innerHeight - anchor.bottom) }}
        >
          {ICE_APPS.map(({ kind, label, Icon }) => (
            <li key={kind}>
              <button type="button" className="xp-start-menu-link w-full" onClick={() => onOpen(kind)}>
                <Icon width={24} height={24} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface StartMenuProps {
  id: string;
  onOpen: (kind: WindowKind) => void;
  onReset: () => void;
  onEditProfile: () => void;
  onSignOut: () => void;
}

export function StartMenu({ id, onOpen, onReset, onEditProfile, onSignOut }: StartMenuProps) {
  const isAdmin = useProfile().me?.isAdmin;
  return (
    <nav id={id} className="xp-start-menu" aria-label="Start menu">
      <div className="xp-start-menu-header">
        <span className="xp-start-menu-avatar">
          <RobotHeadIcon width={36} height={36} />
        </span>
        Smirnoff League
      </div>
      <ul className="xp-start-menu-list">
        {ITEMS.map(({ kind, label, Icon }) => (
          <li key={kind}>
            <button type="button" className="xp-start-menu-link w-full" onClick={() => onOpen(kind)}>
              <Icon width={24} height={24} />
              {label}
            </button>
          </li>
        ))}
        <IcesSubmenu onOpen={onOpen} />
        {isAdmin && (
          <li>
            <button type="button" className="xp-start-menu-link w-full" onClick={() => onOpen("admin")}>
              <ControlPanelIcon width={24} height={24} />
              Control Panel
            </button>
          </li>
        )}
        <li>
          <button type="button" className="xp-start-menu-link w-full" onClick={onEditProfile}>
            <ProfileIcon width={24} height={24} />
            My Profile
          </button>
        </li>
        <li>
          <button type="button" className="xp-start-menu-link w-full" onClick={onReset}>
            <DesktopIcon width={24} height={24} />
            Reset desktop
          </button>
        </li>
      </ul>
      <div className="xp-start-menu-footer">
        <span className="mr-auto">Stay hydrated. Stay iced.</span>
        <button type="button" className="xp-log-off" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
