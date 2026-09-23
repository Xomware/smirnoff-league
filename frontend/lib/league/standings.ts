import type { SleeperRoster } from "@/lib/sleeper/types";

export interface Standing {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
}

// Sleeper's configured tiebreaker is unknown; check this order against
// winners_bracket seeds once Sleeper generates them (PLAN.md).
export function sortStandings(rosters: SleeperRoster[]): Standing[] {
  return rosters
    .map(({ roster_id, settings: s }) => ({
      rosterId: roster_id,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pf: s.fpts + (s.fpts_decimal ?? 0) / 100,
      pa: (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100,
    }))
    .sort((a, b) => b.wins - a.wins || b.ties - a.ties || b.pf - a.pf);
}

const games = (s: Standing) => s.wins + s.ties / 2;

// Within one game of the cut: an in-team that one swing would drop below the
// first team out, or an out-team one swing from catching the last team in.
// Early on the whole league is within a game, so nothing is flagged before
// week 4, and only ranks 6-11 ever are.
export function dangerZone(standings: Standing[], playoffTeams: number, week: number): Set<number> {
  const lastIn = standings[playoffTeams - 1];
  const firstOut = standings[playoffTeams];
  if (!lastIn || !firstOut || week < 4) return new Set();

  return new Set(
    standings
      .filter((s, i) => {
        const rank = i + 1;
        if (rank < 6 || rank > 11) return false;
        return rank <= playoffTeams ? games(s) - games(firstOut) <= 1 : games(lastIn) - games(s) <= 1;
      })
      .map((s) => s.rosterId),
  );
}
