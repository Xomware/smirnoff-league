"use client";

import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import type { Ice } from "@/lib/ices/compute";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { type Player, type Team, useLeague } from "@/lib/league/use-league";
import { DrillLink } from "./drill-link";

export function useSeason() {
  const { data, error: leagueError, teamFor } = useLeague();
  const currentWeek = data ? Math.max(1, data.nfl.week) : undefined;
  const season = useSeasonIces(currentWeek);
  return { data, teamFor, currentWeek, ...season, error: leagueError ?? season.error };
}

interface IceCauseProps {
  ice: Ice;
  players: Record<string, Player>;
}

export function IceCause({ ice, players }: IceCauseProps) {
  if (ice.reason === "lowest") return "Lowest score";
  if (ice.reason === "empty") return "Empty slot";
  const id = ice.playerId!;
  return <DrillLink to={{ kind: "player", playerId: id }}>{players[id]?.name ?? id}</DrillLink>;
}

interface WeekIcesProps {
  groups: [rosterId: number, ices: Ice[]][];
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
}

export function WeekIces({ groups, players, teamFor }: WeekIcesProps) {
  return (
    <div className="grid gap-3">
      {groups.map(([rosterId, owed]) => (
        <div key={rosterId}>
          <DrillLink to={{ kind: "team", rosterId }}>
            <TeamName name={teamFor(rosterId).name} iced ices={owed.length} />
          </DrillLink>
          <ul aria-label={`${teamFor(rosterId).name} ices`} className="mt-1 bg-(--xp-cream)">
            {owed.map((ice) => (
              <PlayerRow
                key={ice.id}
                name={<IceCause ice={ice} players={players} />}
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
