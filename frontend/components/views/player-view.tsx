"use client";

import { TeamName } from "@/components/xp/TeamName";
import { repeatOffenders } from "@/lib/ices/stats";
import { playerWeeks } from "@/lib/league/drill";
import { DrillLink } from "./drill-link";
import { useSeason } from "./week-ices";

interface PlayerViewProps {
  playerId: string;
}

export function PlayerView({ playerId }: PlayerViewProps) {
  const { data, teamFor, finishedWeeks: weeks, error } = useSeason();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !weeks) return <p role="status">Loading the player...</p>;

  const info = data.players[playerId];
  const log = playerWeeks(weeks, playerId);
  const ices = log.filter((w) => w.ice);
  const repeat = repeatOffenders(weeks).find((o) => o.playerId === playerId);

  const weekLink = (week: number) => <DrillLink to={{ kind: "week", week }}>Week {week}</DrillLink>;
  const teamLink = (rosterId: number) => (
    <DrillLink to={{ kind: "team", rosterId }}>
      <TeamName name={teamFor(rosterId).name} iced={false} ices={0} />
    </DrillLink>
  );

  return (
    <div className="grid gap-3">
      <header>
        <h3 className="text-base font-bold">{info?.name ?? playerId}</h3>
        <p>{[info?.position, info?.team].filter(Boolean).join(" · ")}</p>
      </header>

      {repeat && (
        <p className="xp-note font-bold">
          Repeat Offender: {repeat.count} ices across weeks {repeat.weeks.join(", ")}.
        </p>
      )}

      {ices.length === 0 ? (
        <p>No ices caused.</p>
      ) : (
        <div className="xp-table-scroll">
          <table className="xp-table">
            <caption className="mb-2 text-left font-bold">Ices caused</caption>
            <thead>
              <tr>
                <th scope="col" className="w-20">Week</th>
                <th scope="col">Started by</th>
                <th scope="col" className="w-18 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {ices.map((w) => (
                <tr key={w.week} className="ice">
                  <td>{weekLink(w.week)}</td>
                  <td className="md:max-w-0">{teamLink(w.rosterId)}</td>
                  <td className="text-right tabular-nums">{w.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div className="xp-table-scroll">
          <table className="xp-table">
            <caption className="mb-2 text-left font-bold">Weekly points</caption>
            <thead>
              <tr>
                <th scope="col" className="w-20">Week</th>
                <th scope="col">Roster</th>
                <th scope="col" className="w-18">Role</th>
                <th scope="col" className="w-18 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {log.map((w) => (
                <tr key={w.week}>
                  <td>{weekLink(w.week)}</td>
                  <td className="md:max-w-0">{teamLink(w.rosterId)}</td>
                  <td>{w.started ? "Starter" : "Bench"}</td>
                  <td className="text-right tabular-nums">{w.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
