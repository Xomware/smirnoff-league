// ESPN serves this with access-control-allow-origin *, so the browser reads it directly.
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export type GameState = "pre" | "in" | "post";

export interface Game {
  id: string;
  kickoff: string;
  state: GameState;
  // ESPN's status.type.name, e.g. STATUS_HALFTIME.
  status: string;
  period: number;
  clock: string;
  completed: boolean;
  // Sleeper abbreviations.
  teams: string[];
}

interface EspnEvent {
  id: string;
  date: string;
  status: {
    period: number;
    displayClock: string;
    type: { name: string; state: GameState; completed: boolean };
  };
  competitions: { competitors: { team: { abbreviation: string } }[] }[];
}

// Only the differences; checked against both full team lists on 2026-09-22.
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: "WAS" };

export const sleeperTeam = (espn: string) => ESPN_TO_SLEEPER[espn] ?? espn;

// Without seasontype and week ESPN serves its own current week, which lags Sleeper's by a day.
export async function getScoreboard(week: number): Promise<Game[]> {
  const res = await fetch(`${SCOREBOARD}?seasontype=2&week=${week}`);
  if (!res.ok) throw new Error(`ESPN scoreboard week ${week}: ${res.status}`);
  const { events } = (await res.json()) as { events: EspnEvent[] };
  return events.map(({ id, date, status, competitions }) => ({
    id,
    kickoff: date,
    state: status.type.state,
    status: status.type.name,
    period: status.period,
    clock: status.displayClock,
    completed: status.type.completed,
    teams: competitions[0].competitors.map((c) => sleeperTeam(c.team.abbreviation)),
  }));
}
