import Link from "next/link";

import type { WindowKind } from "@/lib/desktop/registry";
import {
  BracketIcon,
  HomeIcon,
  IceBottleIcon,
  IceCubeIcon,
  ProfileIcon,
  ScoresIcon,
  StandingsIcon,
} from "./icons";

const ITEMS = [
  { kind: "home", label: "Home", Icon: HomeIcon },
  { kind: "scores", label: "Scores", Icon: ScoresIcon },
  { kind: "standings", label: "Standings", Icon: StandingsIcon },
  { kind: "brackets", label: "Brackets", Icon: BracketIcon },
  { kind: "ices", label: "Ice Ledger", Icon: IceCubeIcon },
] as const;

interface StartMenuProps {
  id: string;
  onOpen: (kind: WindowKind) => void;
  onEditProfile: () => void;
  onSignOut: () => void;
}

export function StartMenu({ id, onOpen, onEditProfile, onSignOut }: StartMenuProps) {
  return (
    <nav id={id} className="xp-start-menu" aria-label="Start menu">
      <div className="xp-start-menu-header">
        <span className="xp-start-menu-avatar">
          <IceBottleIcon width={28} height={28} />
        </span>
        Smirnoff League
      </div>
      <ul className="xp-start-menu-list">
        {ITEMS.map(({ kind, label, Icon }) => (
          <li key={kind}>
            {/* Links home so the old routes, still live until they redirect, land on the desktop. */}
            <Link href="/" className="xp-start-menu-link" onClick={() => onOpen(kind)}>
              <Icon width={24} height={24} />
              {label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" className="xp-start-menu-link w-full" onClick={onEditProfile}>
            <ProfileIcon width={24} height={24} />
            My Profile
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
