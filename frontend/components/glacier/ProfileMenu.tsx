"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/use-auth";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import type { GlacierView } from "./GlacierShell";

interface ProfileMenuProps {
  urlOf: (to: GlacierView) => string;
  onNav: (e: MouseEvent, to: GlacierView) => void;
}

const page = (kind: GlacierView["kind"]): GlacierView => ({ kind, params: {} });

export function ProfileMenu({ urlOf, onNav }: ProfileMenuProps) {
  const { me, myRosterId } = useProfile();
  const { data, teamFor } = useLeague();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const name = me?.profile?.name ?? "Account";
  const team = data && myRosterId !== null ? teamFor(myRosterId) : null;
  const items: [string, GlacierView][] = [
    ["My Profile", page("profile")],
    ["My Team", page("my-team")],
    ["Settings", page("settings")],
  ];
  // Same gate as the Start menu; the server checks again on every admin call.
  if (me?.isAdmin) items.push(["Admin", page("admin")]);

  return (
    <div ref={root} className="glacier-account">
      <button
        ref={button}
        type="button"
        className="glacier-pill glacier-account-button"
        aria-label={`${name}, account menu`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="glacier-avatar" aria-hidden>
          {team?.avatarUrl ? <Image src={team.avatarUrl} alt="" width={28} height={28} unoptimized /> : name.charAt(0).toUpperCase()}
        </span>
        <span className="glacier-account-name">{name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {open && (
        <nav id={id} aria-label="Account" className="glacier-account-menu">
          <p className="glacier-account-head">
            <strong>{name}</strong>
            {team && <span>{team.name}</span>}
          </p>
          <ul>
            {items.map(([label, to]) => (
              <li key={label}>
                <a
                  href={urlOf(to)}
                  onClick={(e) => {
                    setOpen(false);
                    onNav(e, to);
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => void signOut()}>
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
