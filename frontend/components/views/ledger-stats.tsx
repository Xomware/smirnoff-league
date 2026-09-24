"use client";

import { chugTime } from "@/components/videos/ChugTime";
import type { Ledger } from "@/lib/api/ledger";
import { timeLeft } from "@/lib/ices/chug-board";
import { ledgerStats } from "@/lib/ices/ledger-stats";
import type { Team } from "@/lib/league/use-league";
import { DrillLink, type DrillTarget } from "./drill-link";

interface Stat {
  label: string;
  value: string;
  sub: string;
  to?: DrillTarget;
  alarm?: boolean;
}

interface LedgerStatsProps {
  ledger: Ledger;
  now: number;
  teamFor: (rosterId: number) => Team;
}

export function LedgerStats({ ledger, now, teamFor }: LedgerStatsProps) {
  const s = ledgerStats(ledger, now);
  const deadlineWeek = ledger.weeks.find((w) => w.deadlineUtc && Date.parse(w.deadlineUtc) === s.deadline)?.week;
  const stats: Stat[] = [
    { label: "Owed now", value: String(s.owed), sub: "across the league", to: { kind: "ice-standings" }, alarm: s.owed > 0 },
    { label: "Late", value: String(s.late), sub: "past the deadline", to: { kind: "ice-standings" }, alarm: s.late > 0 },
    { label: "Completed", value: String(s.completed), sub: "this season", to: { kind: "videos" } },
    s.deadline === null
      ? { label: "Next deadline", value: "None", sub: "nothing pending" }
      : { label: "Next deadline", value: timeLeft(s.deadline - now), sub: `Week ${deadlineWeek} chugs` },
    s.fastest
      ? {
          label: "Fastest chug",
          value: chugTime(s.fastest.seconds),
          sub: `${s.fastest.name ?? teamFor(s.fastest.rosterId).name} · Week ${s.fastest.week}`,
          to: { kind: "chug-rankings" },
        }
      : { label: "Fastest chug", value: "None", sub: "no times logged", to: { kind: "chug-rankings" } },
  ];

  return (
    <section className="xp-group ledger-stats" aria-label="Season at a glance">
      <h3 className="xp-group-title">Season at a glance</h3>
      <ul className="ledger-stat-grid">
        {stats.map((stat) => {
          const body = (
            <>
              <span className="ledger-stat-label">{stat.label}</span>
              <span className="ledger-stat-value">{stat.value}</span>
              <span className="ledger-stat-sub">{stat.sub}</span>
            </>
          );
          return (
            <li key={stat.label} className="ledger-stat" data-alarm={stat.alarm || undefined}>
              {stat.to ? <DrillLink to={stat.to}>{body}</DrillLink> : body}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
