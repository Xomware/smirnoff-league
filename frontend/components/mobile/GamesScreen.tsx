"use client";

import { useState } from "react";

import { BackArrowIcon, ForwardArrowIcon } from "@/components/xp/icons";
import { POLL_MS } from "@/lib/ices/use-ice-watch";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useWeekGames } from "@/lib/league/use-week-games";
import { MatchupCard } from "./MatchupCard";

// Games > Scores: a week's matchups, each opening its game.
export function GamesScreen() {
  const initial = useDefaultWeek();
  const [picked, setPicked] = useState<number>();
  const week = picked ?? initial;
  const { data, games, current, live, liveGames, error, teamFor } = useWeekGames(week);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || week === undefined || current === undefined) return <p role="status">Loading the games...</p>;

  const status = !live
    ? "Final scores."
    : liveGames > 0
      ? `${liveGames} ${liveGames === 1 ? "game" : "games"} live. Ice Watch checks every ${POLL_MS / 1000} seconds.`
      : "This week. Empty slots count once every game has kicked off.";

  return (
    <div className="m-page">
      <div className="m-weeks">
        <button type="button" className="m-step" aria-label="Previous week" disabled={week <= 1} onClick={() => setPicked(week - 1)}>
          <BackArrowIcon width={28} height={28} />
        </button>
        <label className="m-week-pick">
          <span className="sr-only">Week</span>
          <select value={week} onChange={(e) => setPicked(Number(e.target.value))}>
            {Array.from({ length: current }, (_, i) => current - i).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="m-step" aria-label="Next week" disabled={week >= current} onClick={() => setPicked(week + 1)}>
          <ForwardArrowIcon width={28} height={28} />
        </button>
      </div>
      <p aria-live="polite" className="m-caption">
        {status}
      </p>
      {!games ? (
        <p role="status">Loading week {week}...</p>
      ) : games.length === 0 ? (
        <p className="m-empty">No matchups for week {week} yet.</p>
      ) : (
        <ul aria-label={`Week ${week} matchups`} className="m-stack">
          {games.map((game) => (
            <li key={`${week}-${game.id}`}>
              <MatchupCard week={week} game={game} players={data.players} teamFor={teamFor} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
