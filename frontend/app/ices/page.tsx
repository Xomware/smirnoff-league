"use client";

import { IceBadge } from "@/components/xp/IceBadge";
import { IceCubeIcon } from "@/components/xp/icons";
import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import type { Ice } from "@/lib/ices/compute";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { type Player, type Team, useLeague } from "@/lib/league/use-league";

interface WeekListProps {
  ices: Ice[];
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
}

function causeOf(ice: Ice, players: Record<string, Player>): string {
  if (ice.reason === "lowest") return "Lowest score";
  if (ice.reason === "empty") return "Empty slot";
  return players[ice.playerId!]?.name ?? ice.playerId!;
}

function WeekList({ ices, players, teamFor }: WeekListProps) {
  const byRoster = new Map<number, Ice[]>();
  for (const ice of ices) byRoster.set(ice.rosterId, [...(byRoster.get(ice.rosterId) ?? []), ice]);

  return (
    <div className="grid gap-3">
      {[...byRoster].map(([rosterId, owed]) => (
        <div key={rosterId}>
          <TeamName name={teamFor(rosterId).name} iced ices={owed.length} />
          <ul aria-label={`${teamFor(rosterId).name} ices`} className="mt-1 bg-(--xp-cream)">
            {owed.map((ice) => (
              <PlayerRow
                key={ice.id}
                name={causeOf(ice, players)}
                position={ice.slot ?? "TEAM"}
                points={ice.points}
                iced
                ices={0}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function IcesPage() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, error: icesError } = useSeasonIces(currentWeek);
  const error = leagueError ?? icesError;

  return (
    <main className="xp-page">
      <Window title="Ice Ledger" icon={<IceCubeIcon />} controls>
        {error ? (
          <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>
        ) : !data || !tally ? (
          <p role="status">Tallying the ices...</p>
        ) : (
          <>
            <table className="xp-table">
              <caption className="mb-2 text-left text-sm font-bold">Owed — provisional</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12">#</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="w-18 text-right">Owed</th>
                </tr>
              </thead>
              <tbody>
                {tally.owed.map((t, i) => (
                  <tr key={t.rosterId}>
                    <td>{i + 1}</td>
                    <td className="max-w-0">
                      <TeamName name={teamFor(t.rosterId).name} iced={t.total > 0} ices={0} />
                    </td>
                    <td className="text-right">
                      {t.total > 0 ? <IceBadge count={t.total} /> : <span className="tabular-nums">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="xp-note mt-2">
              Owed from Sleeper scores for finished weeks. Completions and late ices arrive with the
              ledger.
            </p>
          </>
        )}
      </Window>

      {data && tally && !error && (
        <>
          <Window title={`Week ${currentWeek} — live, provisional`} icon={<IceCubeIcon />}>
            <p className="xp-note">Zeros and the lowest score lock in when the week ends. Only empty slots count now.</p>
            {!tally.live || tally.live.ices.length === 0 ? (
              <p>No empty slots this week.</p>
            ) : (
              <WeekList ices={tally.live.ices} players={data.players} teamFor={teamFor} />
            )}
          </Window>
          {[...tally.weeks].reverse().map(({ week, ices }) => (
            <Window key={week} title={`Week ${week}`} icon={<IceCubeIcon />}>
              {ices.length === 0 ? (
                <p>No ices this week.</p>
              ) : (
                <WeekList ices={ices} players={data.players} teamFor={teamFor} />
              )}
            </Window>
          ))}
        </>
      )}
    </main>
  );
}
