"use client";

import { type ComponentType, type SVGProps, useSyncExternalStore } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TeamName } from "@/components/xp/TeamName";
import {
  BracketIcon,
  ChartIcon,
  ChugRankIcon,
  ControlPanelIcon,
  MediaPlayerIcon,
  NewsFeedIcon,
  NewspaperIcon,
  ProfileIcon,
  SpeakerIcon,
  StandingsIcon,
  StarIcon,
} from "@/components/xp/icons";
import { useAuth } from "@/lib/auth/use-auth";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import type { ScreenKind } from "@/lib/phone/nav";
import { useProfile } from "@/lib/profile/use-profile";
import { isMuted, play, setMuted, subscribeMuted } from "@/lib/sound/sound";
import { usePush } from "./push";

interface Row {
  kind: ScreenKind;
  label: string;
  blurb: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ROWS: Row[] = [
  { kind: "standings", label: "Standings", blurb: "Records, points and the playoff cut", Icon: StandingsIcon },
  { kind: "brackets", label: "Brackets", blurb: "The playoffs and the toilet bowl", Icon: BracketIcon },
  { kind: "news", label: "League News", blurb: "Moves, trades and ice events", Icon: NewsFeedIcon },
  { kind: "writeup", label: "News Drop", blurb: "The commish's weekly edition", Icon: NewspaperIcon },
  { kind: "recap", label: "Draft Recap", blurb: "The draft, replayed", Icon: MediaPlayerIcon },
  { kind: "stats", label: "Ice Stats", blurb: "The race, heat check and Hall of Shame", Icon: ChartIcon },
  { kind: "chug-rankings", label: "Ice Rankings", blurb: "Chug times ranked by personal best", Icon: ChugRankIcon },
  { kind: "teams", label: "Teams", blurb: "Every team's profile", Icon: ProfileIcon },
  { kind: "my-team", label: "My Team", blurb: "Your results, ices and moves", Icon: StarIcon },
];
const ADMIN: Row = { kind: "admin", label: "Control Panel", blurb: "Ices, week rules and the toilet bowl", Icon: ControlPanelIcon };

const serverMuted = () => false;

export function MenuScreen() {
  const push = usePush();
  const { me } = useProfile();
  const { signOut } = useAuth();
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);
  const rows = me?.isAdmin ? [...ROWS, ADMIN] : ROWS;

  return (
    <div className="m-page">
      <ul aria-label="Menu" className="m-card m-rows">
        {rows.map(({ kind, label, blurb, Icon }) => (
          <li key={kind}>
            <button type="button" className="m-nav-row" onClick={() => push({ kind, params: {} })}>
              <Icon width={32} height={32} className="shrink-0" />
              <span className="m-nav-text">
                <span className="m-nav-label">{label}</span>
                <span className="m-nav-blurb">{blurb}</span>
              </span>
              <span className="m-chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <section aria-labelledby="m-you" className="m-section">
        <h2 id="m-you" className="m-section-title">
          {me?.profile?.name ?? "You"}
        </h2>
        <ul className="m-card m-rows">
          <li>
            <button type="button" className="m-nav-row" onClick={() => push({ kind: "profile", params: {} })}>
              <ProfileIcon width={28} height={28} className="shrink-0" />
              <span className="m-nav-label">My Profile</span>
              <span className="m-chevron" aria-hidden />
            </button>
          </li>
          <li>
            <button type="button" className="m-nav-row" onClick={() => push({ kind: "settings", params: {} })}>
              <ControlPanelIcon width={28} height={28} className="shrink-0" />
              <span className="m-nav-label">Settings</span>
              <span className="m-chevron" aria-hidden />
            </button>
          </li>
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
        </ul>
      </section>
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
