"use client";

import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import { SLOTS } from "@/lib/ices/compute";
import { teamResults, weekSummary } from "@/lib/league/drill";
import { DrillLink } from "./drill-link";
import { IceCause, useSeason } from "./week-ices";

interface TeamViewProps {
  rosterId: number;
}

export function TeamView({ rosterId }: TeamViewProps) {
  const { data, teamFor, currentWeek, tally, finishedWeeks: weeks, liveMatchups: live, error } = useSeason();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !weeks || !live || currentWeek === undefined) {
    return <p role="status">Loading the team...</p>;
  }

  const team = teamFor(rosterId);
  const { wins, losses, ties } = team.record;
  const s = data.rosters.find((r) => r.roster_id === rosterId)?.settings;
  const pf = (s?.fpts ?? 0) + (s?.fpts_decimal ?? 0) / 100;
  const pa = (s?.fpts_against ?? 0) + (s?.fpts_against_decimal ?? 0) / 100;
  const owed = tally.owed.find((t) => t.rosterId === rosterId);
  const results = teamResults(weeks, rosterId);

  // Before kickoff the live week may have no matchups yet, so fall back to the latest finished week.
  const lineup = [{ week: currentWeek, matchups: live }, ...[...weeks].reverse()].find((w) =>
    w.matchups.some((m) => m.roster_id === rosterId),
  );
  const mine = lineup?.matchups.find((m) => m.roster_id === rosterId);
  const lineupIces = lineup
    ? (weekSummary(lineup.week, lineup.matchups, lineup.week === currentWeek).icesByRoster.find(
        ([id]) => id === rosterId,
      )?.[1] ?? [])
    : [];
  const icedSlots = new Set(lineupIces.map((i) => i.slotIndex));

  return (
    <div className="grid gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TeamName name={team.name} avatarUrl={team.avatarUrl} iced={!!owed?.total} ices={owed?.total ?? 0} />
        <span className="font-bold tabular-nums">
          {wins}-{losses}
          {ties > 0 && `-${ties}`}
        </span>
        <span className="tabular-nums">
          PF {pf.toFixed(2)} · PA {pa.toFixed(2)}
        </span>
      </header>

      {lineup && mine && (
        <section aria-label="Starters">
          <h3 className="font-bold">Starters, week {lineup.week}</h3>
          <ul aria-label={`Starters, week ${lineup.week}`} className="mt-1 bg-(--xp-cream)">
            {SLOTS.map((slot, i) => {
              const pid = mine.starters[i];
              const iced = icedSlots.has(i);
              return (
                <PlayerRow
                  key={i}
                  name={
                    !pid || pid === "0" ? (
                      "Empty"
                    ) : (
                      <DrillLink to={{ kind: "player", playerId: pid }}>{data.players[pid]?.name ?? pid}</DrillLink>
                    )
                  }
                  position={slot}
                  points={mine.starters_points[i] ?? 0}
                  iced={iced}
                  ices={iced ? 1 : 0}
                />
              );
            })}
          </ul>
        </section>
      )}

      <table className="xp-table">
        <caption className="mb-2 text-left font-bold">Weekly results</caption>
        <thead>
          <tr>
            <th scope="col" className="w-20">Week</th>
            <th scope="col">Opponent</th>
            <th scope="col" className="w-28 text-right">Score</th>
            <th scope="col" className="w-10">W/L</th>
            <th scope="col">Ices</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.week}>
              <td>
                <DrillLink to={{ kind: "week", week: r.week }}>Week {r.week}</DrillLink>
              </td>
              <td className="max-w-0">
                {r.opponent ? (
                  <DrillLink to={{ kind: "team", rosterId: r.opponent.rosterId }}>
                    <TeamName name={teamFor(r.opponent.rosterId).name} iced={false} ices={0} />
                  </DrillLink>
                ) : (
                  "Bye"
                )}
              </td>
              <td className="text-right tabular-nums">
                {r.points.toFixed(2)}
                {r.opponent && ` - ${r.opponent.points.toFixed(2)}`}
              </td>
              <td className="font-bold">{r.result ?? "-"}</td>
              <td>
                {r.ices.length === 0 ? (
                  "None"
                ) : (
                  <ul className="flex flex-col gap-1">
                    {r.ices.map((ice) => (
                      <li key={ice.id}>
                        <IceCause ice={ice} players={data.players} />
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="Season ices">
        <h3 className="font-bold">Season ices: {owed?.total ?? 0}</h3>
        <ul aria-label="Season ices by reason" className="mt-1 flex flex-wrap gap-x-4">
          <li>Zero points: {owed?.reasons.zero ?? 0}</li>
          <li>Empty slot: {owed?.reasons.empty ?? 0}</li>
          <li>Lowest score: {owed?.reasons.lowest ?? 0}</li>
        </ul>
      </section>
    </div>
  );
}
