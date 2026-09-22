"use client";

import { useMemo } from "react";

import { iceStats } from "@/lib/ices/stats";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useLeague } from "@/lib/league/use-league";
import { BarChart } from "./bar-chart";
import { HallOfShame } from "./hall-of-shame";

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];
const REASONS = { zero: "Zero", empty: "Empty", lowest: "Lowest" } as const;

const rank = (pos: string) => (POSITION_ORDER.indexOf(pos) + 1 || POSITION_ORDER.length + 1);

export function StatsView() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { finishedWeeks, error: icesError } = useSeasonIces(currentWeek);
  const error = leagueError ?? icesError;

  const stats = useMemo(
    () => data && finishedWeeks && iceStats(finishedWeeks, (id) => data.players[id]?.position),
    [data, finishedWeeks],
  );

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !stats) return <p role="status">Counting the ices...</p>;
  if (stats.byWeek.length === 0) {
    return <p>No finished weeks yet. The Hall of Shame is still taking applications.</p>;
  }

  const teamName = (rosterId: number) => teamFor(rosterId).name;
  const playerName = (id: string) => data.players[id]?.name ?? id;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChart title="Ices by week" bars={stats.byWeek.map((w) => ({ label: `W${w.week}`, value: w.count }))} />
        <BarChart
          title="Ices by reason"
          bars={Object.entries(REASONS).map(([reason, label]) => ({
            label,
            value: stats.byReason[reason as keyof typeof REASONS],
          }))}
          empty="No ices at all. Suspicious."
        />
        <BarChart
          title="Ices by team"
          horizontal
          bars={stats.byTeam.map((t) => ({ label: teamName(t.rosterId), value: t.count }))}
          empty="Nobody owes an ice. Suspicious."
        />
        <BarChart
          title="Ices by position"
          bars={Object.entries(stats.byPosition)
            .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
            .map(([label, value]) => ({ label, value }))}
          empty="No starter has zeroed out. Yet."
        />
      </div>
      <h3 className="text-base font-bold">Hall of Shame</h3>
      <HallOfShame stats={stats} teamName={teamName} playerName={playerName} />
    </div>
  );
}
