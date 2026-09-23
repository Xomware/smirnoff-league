"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { ControlPanelIcon, IceBottleIcon, ProfileIcon, SpeakerIcon } from "@/components/xp/icons";
import { REGISTRY, type WindowKind } from "@/lib/desktop/registry";
import { useProfile } from "@/lib/profile/use-profile";
import { isMuted, play, setMuted, subscribeMuted } from "@/lib/sound/sound";

const VIEWS: { kind: WindowKind; label: string }[] = [
  { kind: "news", label: "League News" },
  { kind: "writeup", label: "News Drop" },
  { kind: "brackets", label: "Brackets" },
  { kind: "stats", label: "Ice Stats" },
  { kind: "watch", label: "Ice Watch" },
  { kind: "ice-standings", label: "Ice Standings" },
  { kind: "videos", label: "Chug Videos" },
  { kind: "recap", label: "Draft Recap" },
];

const serverMuted = () => false;

interface StartSheetProps {
  id: string;
  name: string;
  onOpen: (kind: WindowKind) => void;
  onEditProfile: () => void;
  onSignOut: () => void;
}

// The XP Start menu as a bottom sheet: league views in the white column, the
// user's own things in the blue one.
export function StartSheet({ id, name, onOpen, onEditProfile, onSignOut }: StartSheetProps) {
  const first = useRef<HTMLButtonElement>(null);
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);
  const isAdmin = useProfile().me?.isAdmin;

  useEffect(() => first.current?.focus(), []);

  return (
    <nav id={id} className="xp-start-menu phone-sheet" aria-label="Start menu">
      <div className="xp-start-menu-header">
        <span className="xp-start-menu-avatar">
          <IceBottleIcon width={28} height={28} />
        </span>
        <span className="truncate">{name}</span>
      </div>
      <div className="phone-sheet-columns">
        <ul className="phone-sheet-list">
          {VIEWS.map(({ kind, label }, i) => {
            const { Icon } = REGISTRY[kind];
            return (
              <li key={kind}>
                <button ref={i === 0 ? first : undefined} type="button" className="xp-start-menu-link w-full" onClick={() => onOpen(kind)}>
                  <Icon width={24} height={24} className="shrink-0" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="phone-sheet-list phone-sheet-side">
          {isAdmin && (
            <li>
              <button type="button" className="xp-start-menu-link w-full" onClick={() => onOpen("admin")}>
                <ControlPanelIcon width={24} height={24} className="shrink-0" />
                Control Panel
              </button>
            </li>
          )}
          <li>
            <button type="button" className="xp-start-menu-link w-full" onClick={onEditProfile}>
              <ProfileIcon width={24} height={24} className="shrink-0" />
              My Profile
            </button>
          </li>
          <li>
            <button
              type="button"
              className="xp-start-menu-link w-full"
              aria-pressed={muted}
              onClick={() => {
                setMuted(!muted);
                if (muted) play("ding");
              }}
            >
              <SpeakerIcon muted={muted} width={24} height={24} className="shrink-0" />
              Mute sounds
            </button>
          </li>
        </ul>
      </div>
      <div className="xp-start-menu-footer">
        <span className="mr-auto">Stay hydrated. Stay iced.</span>
        <button type="button" className="xp-log-off" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
