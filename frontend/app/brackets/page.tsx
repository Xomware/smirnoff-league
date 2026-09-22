"use client";

import { useEffect, useMemo, useState } from "react";

import { BracketIcon, WarningIcon } from "@/components/xp/icons";
import { DrillLink } from "@/components/views/drill-link";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import {
  type Bracket,
  fromSleeper,
  lastFinishedWeek,
  type Match,
  projectedPlayoffBracket,
  punishmentRisk,
  type Slot,
  toiletBowl,
} from "@/lib/league/brackets";
import { sortStandings } from "@/lib/league/standings";
import { type Team, useLeague } from "@/lib/league/use-league";
import { getLosersBracket, getMatchups, getWinnersBracket } from "@/lib/sleeper/client";
import type { SleeperBracketMatch, SleeperMatchup } from "@/lib/sleeper/types";

interface Playoffs {
  winners: SleeperBracketMatch[] | null;
  losers: SleeperBracketMatch[] | null;
  results: SleeperMatchup[][];
}

interface SlotRowProps {
  slot: Slot;
  out: boolean;
  teamFor: (rosterId: number) => Team;
}

function SlotRow({ slot, out, teamFor }: SlotRowProps) {
  return (
    <li className={`xp-slot${out ? " xp-slot-out" : ""}`}>
      <span className="xp-seed">{slot.seed ?? ""}</span>
      {slot.rosterId === null ? (
        <span className="min-w-0">
          TBD {slot.from && <span className="xp-slot-from">({slot.from})</span>}
        </span>
      ) : (
        <DrillLink to={{ kind: "team", rosterId: slot.rosterId }}>
          <TeamName name={teamFor(slot.rosterId).name} iced={false} ices={0} />
        </DrillLink>
      )}
      {out && <span className="sr-only">(out)</span>}
    </li>
  );
}

interface BracketViewProps {
  bracket: Bracket;
  roundNames: string[];
  startWeek: number;
  // Who leaves each game: the loser in the playoffs, the winner in the toilet bowl.
  exits: "winner" | "loser";
  teamFor: (rosterId: number) => Team;
}

function BracketView({ bracket, roundNames, startWeek, exits, teamFor }: BracketViewProps) {
  const row = (m: Match, s: Slot) => (
    <SlotRow slot={s} out={s.rosterId !== null && m[exits] === s.rosterId} teamFor={teamFor} />
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {bracket.rounds.map((matches, i) => (
        <section key={i} className="min-w-0" aria-label={roundNames[i] ?? `Round ${i + 1}`}>
          <h3 className="xp-round-title">
            {roundNames[i] ?? `Round ${i + 1}`}{" "}
            <span className="font-normal">
              <DrillLink to={{ kind: "week", week: startWeek + i }}>Week {startWeek + i}</DrillLink>
            </span>
          </h3>
          <ol className="flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.id} className="xp-bracket-match">
                <span className="xp-slot-from">Game {m.id}</span>
                <ul>
                  {row(m, m.a)}
                  {row(m, m.b)}
                </ul>
              </li>
            ))}
          </ol>
          {i === 0 && bracket.byes.length > 0 && (
            <ul className="xp-bracket-match mt-2" aria-label="Round 1 byes">
              {bracket.byes.map((s) => (
                <li key={s.rosterId} className="xp-slot">
                  <span className="xp-seed">{s.seed}</span>
                  {s.rosterId !== null && (
                    <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
                      <TeamName name={teamFor(s.rosterId).name} iced={false} ices={0} />
                    </DrillLink>
                  )}
                  <span className="xp-tag ml-auto">Bye</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function BracketsPage() {
  const { data, error: leagueError, teamFor } = useLeague();
  const [playoffs, setPlayoffs] = useState<Playoffs | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = data?.league.settings.playoff_week_start ?? 15;
  const finished = data ? lastFinishedWeek(data.nfl, data.league.season) : 0;
  const seeded = finished >= start - 1;

  useEffect(() => {
    if (!data) return;
    let live = true;
    const weeks = [start, start + 1, start + 2].filter((w) => w <= finished);
    Promise.all([getWinnersBracket(), getLosersBracket(), Promise.all(weeks.map(getMatchups))])
      .then(([winners, losers, results]) => live && setPlayoffs({ winners, losers, results }))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [data, start, finished]);

  const view = useMemo(() => {
    if (!data || !playoffs) return null;
    const seeds = sortStandings(data.rosters).map((s) => s.rosterId);
    const sleeperWinners = seeded && playoffs.winners?.length ? playoffs.winners : null;
    const toilet = toiletBowl(seeds, seeded ? playoffs.losers : null, seeded ? playoffs.results : []);
    return {
      projected: !sleeperWinners,
      bracket: sleeperWinners ? fromSleeper(sleeperWinners, seeds) : projectedPlayoffBracket(seeds),
      toilet,
      risk: punishmentRisk(toilet),
    };
  }, [data, playoffs, seeded]);

  const failed = leagueError ?? error;
  if (failed || !view) {
    return (
      <main className="xp-page">
        <Window title="Brackets" icon={<BracketIcon />} controls>
          {failed ? (
            <p role="alert">Could not reach Sleeper ({failed}). Refresh to try again.</p>
          ) : (
            <p role="status">Loading the brackets...</p>
          )}
        </Window>
      </main>
    );
  }

  const { toilet } = view;
  const byeSeeds = toilet.byes.map((s) => s.seed).join(" and ");

  return (
    <main className="xp-page">
      <Window title="Playoffs" icon={<BracketIcon />} controls>
        {view.projected && (
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <span className="xp-tag">Projected</span>
            Seeded from today&apos;s standings. Sleeper sets the real bracket after week {start - 1}.
          </p>
        )}
        <BracketView
          bracket={view.bracket}
          roundNames={["Quarterfinals", "Semifinals", "Final"]}
          startWeek={start}
          exits="loser"
          teamFor={teamFor}
        />
      </Window>

      <Window title="Toilet Bowl" icon={<BracketIcon />} controls>
        <p className="xp-note mb-3">
          Loser advances: win once and you are safe. Seeds {byeSeeds} get round-1 byes, which only puts them one loss
          from the final. Lose in week {start} and you face a bye team in week {start + 1}. Lose again and you are in
          the week {start + 2} final. Lose that and you spend a night in a dark closet with a head lamp and a
          300-piece puzzle.
        </p>
        <BracketView
          bracket={toilet}
          roundNames={["Round 1", "Round 2", "Final"]}
          startWeek={start}
          exits="winner"
          teamFor={teamFor}
        />
      </Window>

      <Window title="Closet Watch" icon={<WarningIcon />}>
        <div className="flex items-start gap-3" aria-live="polite">
          <WarningIcon width={32} height={32} className="shrink-0" />
          <div className="min-w-0 flex-1">
            {toilet.punished !== null ? (
              <p className="font-bold">{teamFor(toilet.punished).name} lost every toilet bowl game. Closet time.</p>
            ) : (
              <p className="mb-2">
                {seeded
                  ? "Still alive in the toilet bowl, and one bad week closer to the closet:"
                  : "The bottom 6 right now. Finish here and you are in the toilet bowl:"}
              </p>
            )}
            <ol aria-label="At risk of the closet" className="flex flex-col gap-1">
              {view.risk.map((id) => (
                <li key={id} className="min-w-0">
                  <DrillLink to={{ kind: "team", rosterId: id }}>
                    <TeamName name={teamFor(id).name} iced={false} ices={0} />
                  </DrillLink>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Window>
    </main>
  );
}
