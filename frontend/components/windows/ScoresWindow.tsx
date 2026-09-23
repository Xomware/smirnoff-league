"use client";

import { useId, useMemo, useState } from "react";

import { DrillLink } from "@/components/views/drill-link";
import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import {
  defaultWeekSettings,
  lockedIces,
  SLOTS,
  weekIces,
} from "@/lib/ices/compute";
import { useDefaultWeek } from "@/lib/league/default-week";
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
    <section className="xp-group" aria-label={`Matchup ${id}`}>
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
              <TeamName
                name={teamFor(s.roster_id).name}
                iced={count > 0}
                ices={count}
              />
              <span
                className={`xp-score${s.points === top ? " font-bold" : ""}`}
              >
                {s.points.toFixed(2)}
              </span>
            </span>
          );
        })}
      </button>
      {open && (
        <div id={starters} className="mt-2 grid gap-2 sm:grid-cols-2">
          {sides.map((s) => (
            <div key={s.roster_id}>
              {/* The team names above sit inside the expand toggle, where a nested button is invalid. */}
              <DrillLink to={{ kind: "team", rosterId: s.roster_id }}>
                <TeamName
                  name={teamFor(s.roster_id).name}
                  iced={false}
                  ices={0}
                />
              </DrillLink>
              {s.starters === null ? (
                <p className="xp-note mt-1">
                  Sleeper has no lineup for this team yet.
                </p>
              ) : (
                <ul
                  aria-label={`${teamFor(s.roster_id).name} starters`}
                  className="mt-1 bg-(--xp-cream)"
                >
                  {SLOTS.map((slot, i) => {
                    const pid = s.starters![i];
                    const iced = ices.slots.has(`${s.roster_id}:${i}`);
                    return (
                      <PlayerRow
                        key={i}
                        name={
                          !pid || pid === "0" ? (
                            "Empty"
                          ) : (
                            <DrillLink to={{ kind: "player", playerId: pid }}>
                              {players[pid]?.name ?? pid}
                            </DrillLink>
                          )
                        }
                        position={slot}
                        points={s.starters_points[i] ?? 0}
                        iced={iced}
                        ices={iced ? 1 : 0}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StepIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden focusable="false">
      <path d={d} className="fill-current" />
    </svg>
  );
}

export function ScoresWindow() {
  const [week, setWeek] = useState<number>();
  const picker = useId();
  const { data, matchups, error, teamFor } = useLeague(week);
  const current = data ? Math.max(1, data.nfl.week) : undefined;
  const initial = useDefaultWeek(data?.nfl);
  if (week === undefined && initial !== undefined) setWeek(initial);

  const ices = useMemo<IceIndex>(() => {
    const index: IceIndex = { byRoster: new Map(), slots: new Set() };
    if (!matchups || week === undefined) return index;
    const ices =
      week === current
        ? lockedIces(week, matchups, SLOTS)
        : weekIces(week, matchups, SLOTS, defaultWeekSettings(week));
    for (const ice of ices) {
      index.byRoster.set(
        ice.rosterId,
        (index.byRoster.get(ice.rosterId) ?? 0) + 1,
      );
      if (ice.slotIndex !== null)
        index.slots.add(`${ice.rosterId}:${ice.slotIndex}`);
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

  if (error)
    return (
      <p role="alert">
        Could not reach Sleeper ({error}). Refresh to try again.
      </p>
    );
  if (!data || current === undefined || week === undefined)
    return <p role="status">Loading the league...</p>;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor={picker} className="font-bold">
          Week
        </label>
        <button
          type="button"
          className="xp-button xp-step"
          aria-label="Previous week"
          disabled={week <= 1}
          onClick={() => setWeek(week - 1)}
        >
          <StepIcon d="M10 3L5 8l5 5z" />
        </button>
        <select
          id={picker}
          className="xp-select"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {Array.from({ length: current }, (_, i) => current - i).map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="xp-button xp-step"
          aria-label="Next week"
          disabled={week >= current}
          onClick={() => setWeek(week + 1)}
        >
          <StepIcon d="M6 3l5 5-5 5z" />
        </button>
      </div>
      <div aria-live="polite" className="grid gap-3">
        {!matchups ? (
          <p role="status">Loading week {week}...</p>
        ) : pairs.length === 0 ? (
          <p>No matchups for week {week} yet.</p>
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
    </div>
  );
}
