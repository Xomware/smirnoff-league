"use client";

import Link from "next/link";

import { IceBadge } from "@/components/xp/IceBadge";
import { IceCubeIcon, MediaPlayerIcon, ScoresIcon, StandingsIcon } from "@/components/xp/icons";
import { DrillLink } from "@/components/views/drill-link";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useLeague } from "@/lib/league/use-league";

const DRAFT_RECAP = "https://www.youtube-nocookie.com/embed/6h-B_O-r7jg";

export default function Home() {
  const { data, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally } = useSeasonIces(currentWeek);

  const liveByRoster = new Map<number, number>();
  for (const ice of tally?.live?.ices ?? []) {
    liveByRoster.set(ice.rosterId, (liveByRoster.get(ice.rosterId) ?? 0) + 1);
  }
  const watch = [...liveByRoster].sort(([, a], [, b]) => b - a);

  return (
    <main className="xp-page">
      <Window title="This week" icon={<IceCubeIcon />} controls>
        <nav aria-label="This week" className="grid gap-2 sm:grid-cols-3">
          <Link href="/scores" className="xp-button">
            <ScoresIcon width={24} height={24} />
            Scores
          </Link>
          <Link href="/standings" className="xp-button">
            <StandingsIcon width={24} height={24} />
            Standings
          </Link>
          <Link href="/ices" className="xp-button">
            <IceCubeIcon width={24} height={24} />
            Ice Ledger
          </Link>
        </nav>

        <div aria-live="polite" className="mt-3">
          {!tally ? (
            <p role="status">Tallying the ices...</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2">
                <div className="xp-note">
                  <dt>Season owed (provisional)</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {tally.owed.reduce((n, t) => n + t.total, 0)}
                  </dd>
                </div>
                <div className="xp-note">
                  <dt>Week {currentWeek} so far (live)</dt>
                  <dd className="text-lg font-bold tabular-nums">{tally.live?.ices.length ?? 0}</dd>
                </div>
              </dl>
              <h3 className="mt-3 font-bold">Ice Watch this week</h3>
              {watch.length === 0 ? (
                <p>Nobody is iced yet this week.</p>
              ) : (
                <ul className="mt-1 grid gap-1">
                  {watch.map(([rosterId, count]) => (
                    <li key={rosterId} className="flex items-center justify-between gap-2">
                      <DrillLink to={{ kind: "team", rosterId }}>
                        <TeamName name={teamFor(rosterId).name} iced ices={0} />
                      </DrillLink>
                      <IceBadge count={count} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Window>

      <Window title="Windows Media Player - Draft Recap.wmv" icon={<MediaPlayerIcon />} controls>
        <div className="aspect-video w-full bg-(--xp-screen)">
          <iframe
            src={DRAFT_RECAP}
            title="Smirnoff League draft recap"
            loading="lazy"
            className="h-full w-full"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </Window>
    </main>
  );
}
