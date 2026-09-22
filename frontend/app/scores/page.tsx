"use client";

import { useId, useMemo, useState } from "react";

import { ScoresIcon } from "@/components/xp/icons";
import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import { defaultWeekSettings, lockedIces, SLOTS, weekIces } from "@/lib/ices/compute";
import { type Player, type Team, useLeague } from "@/lib/league/use-league";
import type { SleeperMatchup } from "@/lib/sleeper/types";

interface IceIndex {
  byRoster: Map<number, number>;
  slots: Set<string>;
}

interface MatchupCardProps {
  id: number;
  sides: SleeperMatchup[];
  ices: IceIndex;
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
}

function MatchupCard({ id, sides, ices, players, teamFor }: MatchupCardProps) {
  const [open, setOpen] = useState(false);
  const starters = useId();
  const top = Math.max(...sides.map((s) => s.points));

  return (
    <Window title={`Matchup ${id}`} icon={<ScoresIcon />}>
      <button
        type="button"
        className="xp-matchup"
        aria-expanded={open}
        aria-controls={starters}
        onClick={() => setOpen((o) => !o)}
      >
        {sides.map((s) => {
          const count = ices.byRoster.get(s.roster_id) ?? 0;
          return (
            <span key={s.roster_id} className="xp-matchup-side">
              <TeamName name={teamFor(s.roster_id).name} iced={count > 0} ices={count} />
              <span className={`xp-score${s.points === top ? " font-bold" : ""}`}>
                {s.points.toFixed(2)}
              </span>
            </span>
          );
        })}
      </button>
      {open && (
        <div id={starters} className="mt-2 grid gap-2 sm:grid-cols-2">
          {sides.map((s) => (
            <ul key={s.roster_id} aria-label={`${teamFor(s.roster_id).name} starters`} className="bg-(--xp-cream)">
              {SLOTS.map((slot, i) => {
                const pid = s.starters[i];
                const iced = ices.slots.has(`${s.roster_id}:${i}`);
                return (
                  <PlayerRow
                    key={i}
                    name={!pid || pid === "0" ? "Empty" : (players[pid]?.name ?? pid)}
                    position={slot}
                    points={s.starters_points[i] ?? 0}
                    iced={iced}
                    ices={iced ? 1 : 0}
                  />
                );
              })}
            </ul>
          ))}
        </div>
      )}
    </Window>
  );
}

export default function ScoresPage() {
  const [week, setWeek] = useState<number>();
  const { data, matchups, error, teamFor } = useLeague(week);
  const current = data ? Math.max(1, data.nfl.week) : undefined;
  if (week === undefined && current !== undefined) setWeek(current);

  const ices = useMemo<IceIndex>(() => {
    const index: IceIndex = { byRoster: new Map(), slots: new Set() };
    if (!matchups || week === undefined) return index;
    const ices =
      week === current ? lockedIces(week, matchups, SLOTS) : weekIces(week, matchups, SLOTS, defaultWeekSettings(week));
    for (const ice of ices) {
      index.byRoster.set(ice.rosterId, (index.byRoster.get(ice.rosterId) ?? 0) + 1);
      if (ice.slotIndex !== null) index.slots.add(`${ice.rosterId}:${ice.slotIndex}`);
    }
    return index;
  }, [matchups, week, current]);

  const pairs = useMemo(() => {
    const byId = new Map<number, SleeperMatchup[]>();
    for (const m of matchups ?? []) {
      if (m.matchup_id === null) continue;
      byId.set(m.matchup_id, [...(byId.get(m.matchup_id) ?? []), m]);
    }
    return [...byId].sort(([a], [b]) => a - b);
  }, [matchups]);

  return (
    <main className="xp-page">
      <Window title="Scores" icon={<ScoresIcon />} controls>
        {error ? (
          <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
        ) : !data || current === undefined ? (
          <p role="status">Loading the league...</p>
        ) : (
          <label className="flex items-center gap-2 font-bold">
            Week
            <select className="xp-select" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: current }, (_, i) => current - i).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
      </Window>

      {data && !error && (
        <div aria-live="polite" className="contents">
          {!matchups ? (
            <p role="status" className="xp-note">Loading week {week}...</p>
          ) : pairs.length === 0 ? (
            <p className="xp-note">No matchups for week {week} yet.</p>
          ) : (
            pairs.map(([id, sides]) => (
              <MatchupCard
                key={`${week}-${id}`}
                id={id}
                sides={sides}
                ices={ices}
                players={data.players}
                teamFor={teamFor}
              />
            ))
          )}
        </div>
      )}
    </main>
  );
}
