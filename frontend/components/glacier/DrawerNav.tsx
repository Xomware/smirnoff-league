"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ControlPanelIcon, ProfileIcon } from "@/components/xp/icons";
import { useAuth } from "@/lib/auth/use-auth";
import type { Screen, Tab } from "@/lib/phone/nav";
import { useProfile } from "@/lib/profile/use-profile";
import { SECTIONS } from "@/lib/sections";
import { LINE_ICONS, LineIcon } from "./GlacierPhone";

const ICONS: Record<string, keyof typeof LINE_ICONS> = {
  home: "home",
  games: "games",
  ices: "ices",
  league: "league",
  "news-drop": "news",
};

const ACCOUNT: { label: string; screen: Screen; Icon: typeof ProfileIcon; admin?: true }[] = [
  { label: "My Profile", screen: { kind: "profile", params: {} }, Icon: ProfileIcon },
  { label: "Settings", screen: { kind: "settings", params: {} }, Icon: ControlPanelIcon },
  { label: "Control Panel", screen: { kind: "admin", params: {} }, Icon: ControlPanelIcon, admin: true },
];

interface DrawerNavProps {
  tab: Tab;
  onSection: (tab: Tab) => void;
  onPage: (screen: Screen) => void;
}

// Only the top level: each section's own pages are sub-tabs on the page itself.
export function DrawerNav({ tab, onSection, onPage }: DrawerNavProps) {
  const isAdmin = useProfile().me?.isAdmin ?? false;
  const { signOut } = useAuth();

  return (
    <>
      <nav aria-label="Main" className="gp-quick">
        {SECTIONS.filter((s) => !s.account).map((s) => (
          <button key={s.id} type="button" aria-current={s.id === tab ? "page" : undefined} onClick={() => onSection(s.id as Tab)}>
            <LineIcon d={LINE_ICONS[ICONS[s.id]]} size={24} />
            {s.label}
          </button>
        ))}
      </nav>
      <nav aria-label="Account">
        <ul className="m-card m-rows">
          {ACCOUNT.filter((a) => isAdmin || !a.admin).map(({ label, screen, Icon }) => (
            <li key={label}>
              <button type="button" className="m-nav-row" onClick={() => onPage(screen)}>
                <Icon width={28} height={28} className="shrink-0" />
                <span className="m-nav-label">{label}</span>
                <span className="m-chevron" aria-hidden />
              </button>
            </li>
          ))}
          <li className="m-row">
            <span className="m-nav-label">Theme</span>
            <ThemeToggle />
          </li>
          <li>
            <button type="button" className="m-nav-row" onClick={() => void signOut()}>
              <span className="m-nav-label m-danger">Sign out</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
