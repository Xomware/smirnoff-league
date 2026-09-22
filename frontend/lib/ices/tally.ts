import { defaultWeekSettings, type Ice, lockedIces, type MatchupRow, SLOTS, weekIces } from "./compute";

export interface RosterTally {
  rosterId: number;
  byWeek: Record<number, number>;
  total: number;
  reasons: Record<Ice["reason"], number>;
}

export interface WeekIces {
  week: number;
  ices: Ice[];
}

export interface SeasonTally {
  owed: RosterTally[];
  weeks: WeekIces[];
  live: WeekIces | null;
}

const icesFor = ({ week, matchups }: { week: number; matchups: MatchupRow[] }): WeekIces => ({
  week,
  ices: weekIces(week, matchups, SLOTS, defaultWeekSettings(week)),
});

// Owed ices from Sleeper alone. Weeks before `currentWeek` are finished and
// counted; the current week is reported separately as live.
export function seasonTally(
  weeks: { week: number; matchups: MatchupRow[] }[],
  currentWeek: number,
): SeasonTally {
  const finished = weeks
    .filter((w) => w.week < currentWeek)
    .sort((a, b) => a.week - b.week)
    .map(icesFor);

  const rosters = new Map<number, RosterTally>();
  for (const m of weeks.flatMap((w) => w.matchups)) {
    if (rosters.has(m.roster_id)) continue;
    rosters.set(m.roster_id, {
      rosterId: m.roster_id,
      byWeek: {},
      total: 0,
      reasons: { zero: 0, empty: 0, lowest: 0 },
    });
  }
  for (const { week, ices } of finished) {
    for (const ice of ices) {
      const t = rosters.get(ice.rosterId)!;
      t.byWeek[week] = (t.byWeek[week] ?? 0) + 1;
      t.total += 1;
      t.reasons[ice.reason] += 1;
    }
  }

  const current = weeks.find((w) => w.week === currentWeek);

  return {
    owed: [...rosters.values()].sort((a, b) => b.total - a.total || a.rosterId - b.rosterId),
    weeks: finished,
    live: current ? { week: current.week, ices: lockedIces(current.week, current.matchups, SLOTS) } : null,
  };
}
