"use client";

import { Fragment } from "react";

import { type IceAnalysis, type takeaways, type WinLoss } from "@/lib/ices/analysis";
import { ChartCard } from "./chart-card";
import { DrillLink } from "./drill-link";
import { GroupedBars } from "./grouped-bars";

interface StatsLineupsProps {
  analysis: IceAnalysis;
  notes: ReturnType<typeof takeaways>;
  teamName: (rosterId: number) => string;
  playerName: (playerId: string) => string;
}

const ratio = (r: WinLoss) => (r.games ? r.wins / r.games : NaN);
const winFmt = (v: number) => (Number.isNaN(v) ? "n/a" : `${Math.round(v * 100)}%`);

export function StatsLineups({ analysis, notes, teamName, playerName }: StatsLineupsProps) {
  const team = (rosterId: number) => <DrillLink to={{ kind: "team", rosterId }}>{teamName(rosterId)}</DrillLink>;
  const player = (playerId: string) => <DrillLink to={{ kind: "player", playerId }}>{playerName(playerId)}</DrillLink>;
  const coach = analysis.bench[0];
  const iced = analysis.results.teams.filter((t) => t.iced.games > 0);

  return (
    <div className="grid items-start gap-3 @2xl:grid-cols-2">
      {coach && coach.total > 0 && (
        <p className="stats-takeaway stats-worst font-normal @2xl:col-span-2">
          <b>Coach of the Year (worst):</b> {team(coach.rosterId)}, with {coach.total.toFixed(1)} points left on the bench
          this season.
        </p>
      )}

      <ChartCard
        title="Bench Points Left"
        takeaway={notes.bench}
        note="Points left = the best legal lineup from the whole roster minus what the starters scored. FLEX takes an RB, WR or TE."
      >
        <GroupedBars
          label="Bench points left per team"
          series={["Season total", "Worst week"]}
          groups={analysis.bench.map((t, i) => ({
            label: teamName(t.rosterId),
            values: [t.total, t.worst.left],
            worst: i === 0 && t.total > 0,
          }))}
          format={(v) => v.toFixed(1)}
          axis="Points left on the bench"
        />
        <ul className="grid text-sm" aria-label="Worst week per team">
          {analysis.bench
            .filter((t) => t.worst.left > 0)
            .map((t) => (
              <li key={t.rosterId} className="border-b border-(--xp-face-shadow) px-1 py-1 last:border-0">
                {team(t.rosterId)}, W{t.worst.week}: <b className="tabular-nums">{t.worst.left.toFixed(1)}</b> left. Should have
                started{" "}
                {t.worst.benched.map((b, i) => (
                  <Fragment key={b.playerId}>
                    {i > 0 && ", "}
                    {player(b.playerId)} ({b.position} {b.points.toFixed(1)})
                  </Fragment>
                ))}
                .
              </li>
            ))}
        </ul>
      </ChartCard>

      <ChartCard
        title="Ices vs Results"
        takeaway={notes.results}
        note="Win rate in weeks a team started a zero or left a slot empty, against its other weeks. Lowest-score ices are left out: they follow from the score."
      >
        <GroupedBars
          label="Win rate with and without a slot ice"
          series={["Weeks with a slot ice", "Weeks without"]}
          groups={[
            { label: "League", values: [ratio(analysis.results.league.iced), ratio(analysis.results.league.clean)] },
            ...iced.map((t) => ({ label: teamName(t.rosterId), values: [ratio(t.iced), ratio(t.clean)] })),
          ]}
          format={winFmt}
          max={1}
          axis="Win rate"
        />
      </ChartCard>
    </div>
  );
}
