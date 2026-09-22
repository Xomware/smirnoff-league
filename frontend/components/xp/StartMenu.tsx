import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  BracketIcon,
  HomeIcon,
  IceBottleIcon,
  IceCubeIcon,
  ScoresIcon,
  StandingsIcon,
} from "./icons";

const LINKS: { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/scores", label: "Scores", Icon: ScoresIcon },
  { href: "/standings", label: "Standings", Icon: StandingsIcon },
  { href: "/brackets", label: "Brackets", Icon: BracketIcon },
  { href: "/ices", label: "Ices", Icon: IceCubeIcon },
];

interface StartMenuProps {
  id: string;
  onNavigate: () => void;
  onSignOut: () => void;
}

export function StartMenu({ id, onNavigate, onSignOut }: StartMenuProps) {
  return (
    <nav id={id} className="xp-start-menu" aria-label="Start menu">
      <div className="xp-start-menu-header">
        <span className="xp-start-menu-avatar">
          <IceBottleIcon width={28} height={28} />
        </span>
        Smirnoff League
      </div>
      <ul className="xp-start-menu-list">
        {LINKS.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="xp-start-menu-link" onClick={onNavigate}>
              <Icon width={24} height={24} />
              {label}
            </Link>
          </li>
        ))}
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
