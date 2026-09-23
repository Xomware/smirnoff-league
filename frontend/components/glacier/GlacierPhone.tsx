"use client";

import Image from "next/image";

import { useDefaultWeek } from "@/lib/league/default-week";
import { useLeague } from "@/lib/league/use-league";
import { Chugs, IceTop, WeekGames, YourIces } from "./GlacierHome";

export const LINE_ICONS = {
  home: "M3 11l9-7 9 7v9H3z",
  games: "M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0M8 12h8M10 10v4M14 10v4",
  ices: "M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5",
  back: "M15 5l-7 7 7 7",
};

interface LineIconProps {
  d: string;
  size?: number;
}

export function LineIcon({ d, size = 22 }: LineIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// The phone shell's bar holds the page's h1, so the hero title is an h2 here.
export function GlacierPhoneHome() {
  const week = useDefaultWeek();
  const { data } = useLeague();

  return (
    <div className="gh gp-home">
      <section aria-label="This week" className="gp-hero">
        {week !== undefined && data && (
          <span className="gh-week">
            Week {week} · {data.league.season}
          </span>
        )}
        <div className="gp-hero-row">
          <h2 className="gh-title">
            Every zero <span>is an ice.</span>
          </h2>
          <Image src="/brand/mascot.png" alt="The league mascot, a robot chugging a Smirnoff Ice" width={130} height={142} priority />
        </div>
      </section>
      <YourIces />
      <Chugs />
      <WeekGames week={week} />
      <IceTop />
    </div>
  );
}
