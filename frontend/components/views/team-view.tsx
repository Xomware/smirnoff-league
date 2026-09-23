"use client";

import Image from "next/image";

import { PlayerRow } from "@/components/xp/PlayerRow";
import { StarIcon, WarningIcon } from "@/components/xp/icons";
import { Tabs } from "@/components/xp/Tabs";
import { TeamName } from "@/components/xp/TeamName";
import { SLOTS } from "@/lib/ices/compute";
import { useLedger } from "@/lib/ices/use-ledger";
import { useDefaultWeek } from "@/lib/league/default-week";
import { weekSummary } from "@/lib/league/drill";
import { headToHead, profileResults, type ResultRow, seasonPoints } from "@/lib/league/profile";
import { dangerZone, sortStandings } from "@/lib/league/standings";
import type { Team } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { ChartCard } from "./chart-card";
import { DrillLink } from "./drill-link";
import { LineChart } from "./line-chart";
import { TeamIces } from "./team-ices";
import { TeamMoves } from "./team-moves";
import { IceCause, useSeason } from "./week-ices";

import "./profile.css";

interface TeamViewProps {
  rosterId: number;
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

interface OpponentLinkProps {
  rosterId: number;
  teamFor: (rosterId: number) => Team;
}

function OpponentLink({ rosterId, teamFor }: OpponentLinkProps) {
  return (
    <DrillLink to={{ kind: "team", rosterId }}>
      <TeamName name={teamFor(rosterId).name} avatarUrl={teamFor(rosterId).avatarUrl} iced={false} ices={0} />
    </DrillLink>
  );
}

export function TeamView({ rosterId }: TeamViewProps) {
  const { data, teamFor, currentWeek, tally, finishedWeeks: weeks, liveMatchups: live, error } = useSeason();
  const shown = useDefaultWeek();
  const ledger = useLedger();
  const { myRosterId } = useProfile();

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !tally || !weeks || !live || currentWeek === undefined || shown === undefined) {
    return <p role="status">Loading the team...</p>;
  }

  const team = teamFor(rosterId);
  const roster = data.rosters.find((r) => r.roster_id === rosterId);
  const manager = data.users.find((u) => u.user_id === roster?.owner_id)?.display_name;
  const s = roster?.settings;
  const pf = (s?.fpts ?? 0) + (s?.fpts_decimal ?? 0) / 100;
  const pa = (s?.fpts_against ?? 0) + (s?.fpts_against_decimal ?? 0) / 100;
  const standings = sortStandings(data.rosters);
  const rank = standings.findIndex((r) => r.rosterId === rosterId) + 1;
  const playoffTeams = data.league.settings.playoff_teams;
  const danger = dangerZone(standings, playoffTeams).has(rosterId);
  const positionOf = (id: string) => data.players[id]?.position;
  const results = profileResults(weeks, rosterId, positionOf);
  const provisional = tally.owed.find((t) => t.rosterId === rosterId)?.total ?? 0;
  const summary = ledger.status === "ok" ? ledger.ledger.summary.find((r) => r.rosterId === rosterId) : undefined;
  const ices =
    ledger.status === "loading"
      ? "..."
      : ledger.status === "error"
        ? `${provisional} provisional`
        : `${(summary?.owed ?? 0) + (summary?.lateOwed ?? 0)} owed · ${(summary?.completed ?? 0) + (summary?.late ?? 0) - (summary?.lateOwed ?? 0)} completed · ${summary?.late ?? 0} late`;

  // Until Thursday night the lineup worth showing is last week's; the live week may not even have matchups yet.
  const lineup = [{ week: currentWeek, matchups: live }, ...[...weeks].reverse()].find(
    (w) => w.week <= shown && w.matchups.some((m) => m.roster_id === rosterId),
  );
  const mine = lineup?.matchups.find((m) => m.roster_id === rosterId);
  const icedSlots = new Set(
    lineup
      ? (weekSummary(lineup.week, lineup.matchups, lineup.week === currentWeek)
          .icesByRoster.find(([id]) => id === rosterId)?.[1]
          .map((i) => i.slotIndex) ?? [])
      : [],
  );
  const points = seasonPoints([...weeks, { week: currentWeek, matchups: live }]);
  const playerName = (id: string) => data.players[id]?.name ?? id;

  const resultsPanel = () => (
    <div className="grid gap-3">
      <div className="xp-table-scroll">
        <table className="xp-table">
          <caption className="sr-only">Weekly results</caption>
          <thead>
            <tr>
              <th scope="col" className="w-18">Week</th>
              <th scope="col">Opponent</th>
              <th scope="col" className="w-30 text-right">Score</th>
              <th scope="col" className="w-10">W/L</th>
              <th scope="col" className="w-18 text-right">Margin</th>
              <th scope="col" className="w-16 text-right" title="Points left on the bench">Bench</th>
              <th scope="col">Ices</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={7}>No finished weeks yet.</td>
              </tr>
            )}
            {results.map((r) => (
              <tr key={r.week}>
                <td className="whitespace-nowrap">
                  <DrillLink to={{ kind: "week", week: r.week }}>Week {r.week}</DrillLink>
                </td>
                <td className="md:max-w-0">{r.opponent ? <OpponentLink rosterId={r.opponent.rosterId} teamFor={teamFor} /> : "Bye"}</td>
                <td className="text-right whitespace-nowrap tabular-nums">
                  {r.points.toFixed(2)}
                  {r.opponent && ` - ${r.opponent.points.toFixed(2)}`}
                </td>
                <td className="font-bold">{r.result ?? "-"}</td>
                <td className="text-right whitespace-nowrap tabular-nums">{r.margin === null ? "-" : signed(r.margin)}</td>
                <td className="text-right tabular-nums">{r.benchLeft === null ? "-" : r.benchLeft.toFixed(2)}</td>
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
      </div>
      {results.length > 0 && <PointsChart results={results} name={team.name} />}
    </div>
  );

  const h2hPanel = () => (
    <div className="xp-table-scroll">
      <table className="xp-table">
        <caption className="sr-only">Head-to-head</caption>
        <thead>
          <tr>
            <th scope="col">Opponent</th>
            <th scope="col" className="w-16 whitespace-nowrap">W-L</th>
            <th scope="col" className="w-20 text-right">PF</th>
            <th scope="col" className="w-20 text-right">PA</th>
          </tr>
        </thead>
        <tbody>
          {headToHead(weeks, rosterId, data.rosters.map((r) => r.roster_id)).map((h) => {
            const played = h.wins + h.losses + h.ties > 0;
            return (
              <tr key={h.rosterId}>
                <td className="md:max-w-0">
                  <OpponentLink rosterId={h.rosterId} teamFor={teamFor} />
                </td>
                <td className="tabular-nums">{played ? `${h.wins}-${h.losses}${h.ties ? `-${h.ties}` : ""}` : "-"}</td>
                <td className="text-right tabular-nums">{played ? h.pf.toFixed(2) : "-"}</td>
                <td className="text-right tabular-nums">{played ? h.pa.toFixed(2) : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const rosterPanel = () => {
    if (!lineup || !mine?.starters) return <p>No lineup from Sleeper yet.</p>;
    const bench = (mine.players ?? [])
      .filter((id) => !mine.starters!.includes(id))
      .sort((a, b) => (points.get(b) ?? 0) - (points.get(a) ?? 0));
    const player = (id: string) => <DrillLink to={{ kind: "player", playerId: id }}>{playerName(id)}</DrillLink>;
    return (
      <div className="grid gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <section aria-label="Starters">
          <h3 className="font-bold">Starters, week {lineup.week}</h3>
          <ul aria-label={`Starters, week ${lineup.week}`} className="mt-1 bg-(--xp-cream)">
            {SLOTS.map((slot, i) => {
              const pid = mine.starters![i];
              const empty = !pid || pid === "0";
              return (
                <PlayerRow
                  key={i}
                  name={empty ? "Empty" : player(pid)}
                  position={slot}
                  points={empty ? 0 : (points.get(pid) ?? 0)}
                  iced={icedSlots.has(i)}
                  ices={icedSlots.has(i) ? 1 : 0}
                />
              );
            })}
          </ul>
        </section>
        <section aria-label="Bench">
          <h3 className="font-bold">Bench</h3>
          <ul aria-label={`Bench, week ${lineup.week}`} className="mt-1 bg-(--xp-cream)">
            {bench.length === 0 && <li className="xp-player-row">Nobody on the bench.</li>}
            {bench.map((id) => (
              <PlayerRow key={id} name={player(id)} position={data.players[id]?.position ?? "BN"} points={points.get(id) ?? 0} iced={false} ices={0} />
            ))}
          </ul>
        </section>
        <p className="text-xs @2xl:col-span-2">Points are season totals.</p>
      </div>
    );
  };

  return (
    <div className="profile grid gap-3">
      <section aria-label={team.name} className="profile-head">
        <span className={`profile-avatar${provisional ? " ice" : ""}`} aria-hidden>
          {team.avatarUrl ? <Image src={team.avatarUrl} alt="" width={56} height={56} className="size-full object-cover" /> : team.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="profile-name">
            {team.name}
            {rosterId === myRosterId && <StarIcon width={18} height={18} className="shrink-0" role="img" aria-hidden={false} aria-label="Your team" />}
          </h3>
          {manager && manager !== team.name && <p className="truncate">{manager}</p>}
        </div>
        <dl className="profile-stats">
          <div>
            <dt>Record</dt>
            <dd>
              {team.record.wins}-{team.record.losses}
              {team.record.ties > 0 && `-${team.record.ties}`}
            </dd>
          </div>
          <div>
            <dt>PF / PA</dt>
            <dd>
              {pf.toFixed(2)} / {pa.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>
              {ordinal(rank)} of {standings.length}{" "}
              {danger ? (
                <span className="profile-chip" data-tone="danger">
                  <WarningIcon width={12} height={12} />
                  Danger zone
                </span>
              ) : (
                <span className="profile-chip" data-tone={rank <= playoffTeams ? "in" : "out"}>
                  {rank <= playoffTeams ? "Playoff spot" : "Out"}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Ices</dt>
            <dd>{ices}</dd>
          </div>
        </dl>
      </section>

      <Tabs
        label={`${team.name} profile`}
        tabs={[
          { label: "Results", panel: resultsPanel },
          { label: "Ices", panel: () => <TeamIces rosterId={rosterId} ledger={ledger} results={results} players={data.players} /> },
          { label: "Transactions", panel: () => <TeamMoves rosterId={rosterId} currentWeek={currentWeek} players={data.players} teamFor={teamFor} /> },
          { label: "Head-to-head", panel: h2hPanel },
          { label: "Roster", panel: rosterPanel },
        ]}
      />
    </div>
  );
}

interface PointsChartProps {
  results: ResultRow[];
  name: string;
}

function PointsChart({ results, name }: PointsChartProps) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const above = results.filter((r) => r.points > r.leagueAvg).length;
  return (
    <ChartCard title="Points per week" takeaway={`Above the league average in ${above} of ${results.length} weeks.`}>
      <LineChart
        label="Points per week"
        xLabels={results.map((r) => `W${r.week}`)}
        top={[
          { label: name, values: results.map((r) => round(r.points)) },
          { label: "League average", values: results.map((r) => round(r.leagueAvg)) },
        ]}
        rest={[]}
        yTitle="Points"
      />
    </ChartCard>
  );
}
