"use client";

import { type ReactElement, useMemo } from "react";

import { type Tab, Tabs } from "@/components/xp/Tabs";
import type { WindowParams } from "@/lib/desktop/windows";
import { iceAnalysis, pct, takeaways } from "@/lib/ices/analysis";
import { iceStats } from "@/lib/ices/stats";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useLeague } from "@/lib/league/use-league";
import { BarChart } from "./bar-chart";
import { ChartCard } from "./chart-card";
import { GroupedBars } from "./grouped-bars";
import { HallOfShame } from "./hall-of-shame";
import { Heatmap } from "./heatmap";
import { LineChart } from "./line-chart";
import { StatsLineups } from "./stats-lineups";
import { StatsOverview } from "./stats-overview";

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];
const REASONS = { zero: "Zero", empty: "Empty", lowest: "Lowest" } as const;

export const STATS_TABS = ["overview", "race", "lineups", "positions", "hall-of-shame"];

const rank = (pos: string) => (POSITION_ORDER.indexOf(pos) + 1 || POSITION_ORDER.length + 1);

export function useStatsSections(): { fallback: ReactElement } | { sections: Tab[] } {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { finishedWeeks, error: icesError } = useSeasonIces(currentWeek);
  const error = leagueError ?? icesError;

  const all = useMemo(() => {
    if (!data || !finishedWeeks) return null;
    const positionOf = (id: string) => data.players[id]?.position;
    return { stats: iceStats(finishedWeeks, positionOf), analysis: iceAnalysis(finishedWeeks, positionOf) };
  }, [data, finishedWeeks]);

  if (error) return { fallback: <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p> };
  if (!data || !all) return { fallback: <p role="status">Counting the ices...</p> };
  if (all.stats.byWeek.length === 0) {
    return { fallback: <p>No finished weeks yet. The Hall of Shame is still taking applications.</p> };
  }

  const { stats, analysis } = all;
  const teamName = (rosterId: number) => teamFor(rosterId).name;
  const playerName = (id: string) => data.players[id]?.name ?? id;
  const notes = takeaways(analysis, teamName);
  const { race, rate, positions } = analysis;
  const weekLabels = race.weeks.map((w) => `W${w}`);
  const series = race.teams.map((t) => ({ label: teamName(t.rosterId), values: t.cumulative }));
  const leaders = race.teams[0].total > 0 ? 3 : 0;
  const riskiest = [...positions].sort((a, b) => b.rate - a.rate)[0];

  const overview = () => (
    <div className="grid gap-3">
      <StatsOverview analysis={analysis} notes={notes} teamName={teamName} />
      <ChartCard title="Ice Counts" takeaway={notes.reasons}>
        <div className="grid gap-4 @2xl:grid-cols-3">
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
            title="Ices by player position"
            bars={Object.entries(stats.byPosition)
              .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
              .map(([label, value]) => ({ label, value }))}
            empty="No starter has zeroed out. Yet."
          />
        </div>
      </ChartCard>
    </div>
  );

  const racePanel = () => (
    <div className="grid items-start gap-3 @2xl:grid-cols-2">
      <ChartCard title="Ice Race" takeaway={notes.race} note="Every ice counts here, lowest-score ones included.">
        <LineChart
          label="Ice race, cumulative ices by week"
          xLabels={weekLabels}
          top={series.slice(0, leaders)}
          rest={series.slice(leaders)}
          yTitle="Ices so far"
        />
      </ChartCard>
      <ChartCard title="Ices by Team and Week" takeaway={notes.weeks}>
        <Heatmap
          label="Ices by team and week"
          columns={weekLabels}
          rows={race.teams.map((t) => ({
            label: teamName(t.rosterId),
            values: t.cumulative.map((c, i) => c - (t.cumulative[i - 1] ?? 0)),
          }))}
        />
      </ChartCard>
      <ChartCard
        title="Ice Rate"
        takeaway={notes.rate}
        note="Rate = zero and empty slot ices / starting slots, 10 a week. Lowest-score ices are left out."
      >
        <GroupedBars
          label="Slot ices per start"
          series={["Ices per start"]}
          groups={rate.teams.map((t, i) => ({ label: teamName(t.rosterId), values: [t.rate], worst: i === 0 && t.ices > 0 }))}
          format={pct}
          axis="Share of starts that iced"
          reference={{ value: rate.league, label: "League avg" }}
        />
      </ChartCard>
    </div>
  );

  const positionsPanel = () => (
    <ChartCard
      title="Position Risk"
      takeaway={notes.positions}
      note="Rate = zero and empty ices in a slot / times that slot was started. RB, WR and FLEX start twice a week."
    >
      <div className="grid items-start gap-4 @2xl:grid-cols-[3fr_2fr]">
        <GroupedBars
          label="Ice rate by lineup slot"
          series={["Ices per start"]}
          groups={positions.map((p) => ({ label: p.slot, values: [p.rate], worst: p === riskiest && p.ices > 0 }))}
          format={pct}
          axis="Share of starts that iced"
          reference={{ value: rate.league, label: "League avg" }}
        />
        <table className="xp-table">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Starts</th>
              <th scope="col">Ices</th>
              <th scope="col">Rate</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.slot} className={p === riskiest && p.ices > 0 ? "xp-danger" : undefined}>
                <th scope="row">{p.slot}</th>
                <td className="tabular-nums">{p.starts}</td>
                <td className="tabular-nums">{p.ices}</td>
                <td className="tabular-nums">{pct(p.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );

  return {
    sections: [
      { id: "overview", label: "Overview", panel: overview },
      { id: "race", label: "Race", panel: racePanel },
      { id: "lineups", label: "Lineups", panel: () => <StatsLineups analysis={analysis} notes={notes} teamName={teamName} playerName={playerName} /> },
      { id: "positions", label: "Positions", panel: positionsPanel },
      { id: "hall-of-shame", label: "Hall of Shame", panel: () => <HallOfShame stats={stats} teamName={teamName} playerName={playerName} /> },
    ],
  };
}

export function StatsView({ params }: { params: WindowParams }) {
  const stats = useStatsSections();
  return "fallback" in stats ? stats.fallback : <Tabs label="Ice Stats sections" tabs={stats.sections} selected={params.tab} />;
}
