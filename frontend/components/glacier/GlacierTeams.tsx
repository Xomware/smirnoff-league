"use client";

import { DrillLink } from "@/components/views/drill-link";
import { TeamName } from "@/components/xp/TeamName";
import { sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

export function GlacierTeams() {
  const { data, error, teamFor } = useLeague();
  const { myRosterId } = useProfile();

  if (error) return <p role="alert">Could not reach Sleeper ({error}).</p>;
  if (!data) return <p role="status">Loading the teams...</p>;

  return (
    <ul aria-label="Teams" className="glacier-teams">
      {sortStandings(data.rosters).map((s) => {
        const team = teamFor(s.rosterId);
        return (
          <li key={s.rosterId}>
            <DrillLink to={{ kind: "team", rosterId: s.rosterId }}>
              <TeamName name={team.name} avatarUrl={team.avatarUrl} iced={false} ices={0} isMine={s.rosterId === myRosterId} />
              <span className="glacier-record">
                {s.wins}-{s.losses}
                {s.ties > 0 && `-${s.ties}`}
              </span>
            </DrillLink>
          </li>
        );
      })}
    </ul>
  );
}
