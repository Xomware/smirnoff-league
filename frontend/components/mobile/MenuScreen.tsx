"use client";

import { useSyncExternalStore } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TeamName } from "@/components/xp/TeamName";
import { ControlPanelIcon, ProfileIcon, SpeakerIcon } from "@/components/xp/icons";
import { useAuth } from "@/lib/auth/use-auth";
import { REGISTRY } from "@/lib/desktop/registry";
import { useDefaultWeek } from "@/lib/league/default-week";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { type PageKind, pagesFor, pageView, SECTIONS, type SubPage } from "@/lib/sections";
import { isMuted, play, setMuted, subscribeMuted } from "@/lib/sound/sound";
import { usePush } from "./push";

const iconOf = (kind: PageKind) =>
  kind === "teams" || kind === "profile" ? ProfileIcon : kind === "settings" ? ControlPanelIcon : REGISTRY[kind].Icon;

const serverMuted = () => false;

// Every section's pages, as on Glacier's sub-nav, each listed once. Home is its own tab.
function groups(isAdmin: boolean) {
  const listed = new Set<PageKind>();
  return SECTIONS.filter((s) => s.id !== "home").map((section) => {
    const pages = pagesFor(section, isAdmin).filter((p) => !listed.has(p.kind));
    pages.forEach((p) => listed.add(p.kind));
    return { section, pages };
  });
}

export function MenuScreen() {
  const push = usePush();
  const week = useDefaultWeek();
  const { me } = useProfile();
  const { signOut } = useAuth();
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);

  const row = (page: SubPage) => {
    const Icon = iconOf(page.kind);
    return (
      <li key={page.kind}>
        <button type="button" className="m-nav-row" onClick={() => push(pageView(page, week))}>
          <Icon width={28} height={28} className="shrink-0" />
          <span className="m-nav-label">{page.label}</span>
          <span className="m-chevron" aria-hidden />
        </button>
      </li>
    );
  };

  return (
    <div className="m-page">
      {groups(me?.isAdmin ?? false).map(({ section, pages }) => (
        <section key={section.id} aria-labelledby={`m-menu-${section.id}`} className="m-section">
          <h2 id={`m-menu-${section.id}`} className="m-section-title">
            {section.account ? (me?.profile?.name ?? "You") : section.label}
          </h2>
          <ul className="m-card m-rows">
            {pages.map(row)}
            {section.account && (
              <>
                <li>
                  <button
                    type="button"
                    className="m-nav-row"
                    aria-pressed={muted}
                    onClick={() => {
                      setMuted(!muted);
                      if (muted) play("ding");
                    }}
                  >
                    <SpeakerIcon muted={muted} width={28} height={28} className="shrink-0" />
                    <span className="m-nav-label">Mute sounds</span>
                    <span className="m-switch" aria-hidden />
                  </button>
                </li>
                <li className="m-row">
                  <span className="m-nav-label">Theme</span>
                  <ThemeToggle />
                </li>
                <li>
                  <button type="button" className="m-nav-row" onClick={() => void signOut()}>
                    <span className="m-nav-label m-danger">Sign out</span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TeamsScreen() {
  const push = usePush();
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data) return <p role="status">Loading the teams...</p>;

  return (
    <div className="m-page">
      <ul aria-label="Teams" className="m-card m-rows">
        {sortStandings(data.rosters).map((s) => {
          const team = teamFor(s.rosterId);
          return (
            <li key={s.rosterId}>
              <button type="button" className="m-nav-row" onClick={() => push({ kind: "team", params: { rosterId: s.rosterId } })}>
                <TeamName name={team.name} avatarUrl={team.avatarUrl} iced={false} ices={0} isMine={s.rosterId === myRosterId} />
                <span className="m-record">
                  {s.wins}-{s.losses}
                  {s.ties > 0 && `-${s.ties}`}
                </span>
                <span className="m-chevron" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
