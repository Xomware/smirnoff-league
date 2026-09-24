"use client";

import { type CSSProperties, useId, useState } from "react";

import { HEAT_WEIGHTS, type IceAnalysis, type takeaways } from "@/lib/ices/analysis";
import { BoardHead } from "./board";
import { ChartCard } from "./chart-card";
import { DrillLink } from "./drill-link";

interface StatsOverviewProps {
  analysis: IceAnalysis;
  notes: ReturnType<typeof takeaways>;
  teamName: (rosterId: number) => string;
}

const pts = (n: number) => n.toFixed(2);
const FORMULA = `Score = ${HEAT_WEIGHTS.map((w, i) => `${w} x ices ${i === 0 ? "last week" : `${i + 1} weeks ago`}`).join(" + ")}. Recent weeks count most; nothing older counts at all.`;

export function StatsOverview({ analysis, notes, teamName }: StatsOverviewProps) {
  const team = (rosterId: number) => <DrillLink to={{ kind: "team", rosterId }}>{teamName(rosterId)}</DrillLink>;
  const weeks = analysis.extremes;
  const [week, setWeek] = useState(weeks[weeks.length - 1].week);
  const pick = weeks.find((w) => w.week === week) ?? weeks[weeks.length - 1];
  const selectId = useId();
  const heat = analysis.heat.filter((h) => h.score > 0).slice(0, 5);
  const row = "flex items-baseline justify-between gap-2 border-b border-(--xp-face-shadow) px-1 py-1 last:border-0";

  return (
    <div className="grid gap-3 @2xl:grid-cols-2">
      <ChartCard title="Heat Check: most likely to ice next" takeaway={notes.heat} note={FORMULA}>
        {heat.length === 0 ? (
          <p>Nobody is running hot. Enjoy it.</p>
        ) : (
          // Early in the season fewer weeks than HEAT_WEIGHTS have finished, so the columns follow the data.
          <div style={{ "--board-cols": `1.5rem minmax(0, 1fr) repeat(${heat[0].recent.length}, 2rem) 2.5rem` } as CSSProperties}>
            <BoardHead labels={["RK", "Team", ...heat[0].recent.map((_, j) => (j === 0 ? "LW" : `${j + 1}W`)), "Pts"]} />
            <ol>
              {heat.map((h, i) => (
                <li key={h.rosterId} className={`board-row${i === 0 ? " stats-worst stats-takeaway font-normal" : ""}`}>
                  <span className="board-rank">{i + 1}</span>
                  <span className="board-who">
                    <span className="board-name">{team(h.rosterId)}</span>
                  </span>
                  {h.recent.map((n, j) => (
                    <span key={j} className="board-num">
                      {n}
                      <span className="sr-only"> {j === 0 ? "last week" : `${j + 1} weeks ago`}</span>
                    </span>
                  ))}
                  <span className="board-num font-bold">
                    {h.score}
                    <span className="sr-only"> pts</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Weekly Extremes" takeaway={notes.extremes}>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="font-bold">Week</label>
          <select id={selectId} className="xp-select" value={pick.week} onChange={(e) => setWeek(Number(e.target.value))}>
            {weeks.map((w) => (
              <option key={w.week} value={w.week}>W{w.week}</option>
            ))}
          </select>
          <DrillLink to={{ kind: "week", week: pick.week }}>Open the W{pick.week} scoreboard</DrillLink>
        </div>
        <dl className="grid" aria-live="polite">
          <div className={row}>
            <dt>High score</dt>
            <dd className="text-right">{team(pick.high.rosterId)} <b className="tabular-nums">{pts(pick.high.points)}</b></dd>
          </div>
          <div className={row}>
            <dt>Low score</dt>
            <dd className="text-right">{team(pick.low.rosterId)} <b className="tabular-nums text-(--smirnoff-red)">{pts(pick.low.points)}</b></dd>
          </div>
          {pick.blowout && (
            <div className={row}>
              <dt>Biggest blowout</dt>
              <dd className="text-right">
                {team(pick.blowout.winner)} over {team(pick.blowout.loser)} by <b className="tabular-nums">{pts(pick.blowout.margin)}</b>
              </dd>
            </div>
          )}
          {pick.closest && (
            <div className={row}>
              <dt>Closest game</dt>
              <dd className="text-right">
                {team(pick.closest.winner)} over {team(pick.closest.loser)} by <b className="tabular-nums">{pts(pick.closest.margin)}</b>
              </dd>
            </div>
          )}
        </dl>
      </ChartCard>
    </div>
  );
}
