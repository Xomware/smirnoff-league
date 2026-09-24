import { type Game, getScoreboard } from "@/lib/espn";
import { iceStandings } from "@/lib/ices/standings";
import { seasonTally } from "@/lib/ices/tally";
import { leagueMatchups, nflState, rosters, users } from "./cache";
import { sortStandings, type Standing } from "./standings";

export interface Overview {
  season: string;
  week: number;
  headline: string;
  live: boolean;
  leader: { name: string; record: string };
  last: { name: string; record: string };
  iceLeader: { name: string; total: number; tied: number } | null;
  icesThisWeek: number;
  icesLastWeek: number | null;
  nextKickoff: string | null;
}

const REGULAR_SEASON_WEEKS = 18;

export function formatKickoff(iso: string): string {
  const time = new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  // Newer ICU puts a narrow no-break space before PM.
  return `${time.replace(/\s/g, " ")} ET`;
}

const firstPre = (games: Game[]) =>
  games.filter((g) => g.state === "pre").sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];

export function weekHeadline(week: number, games: Game[]): string {
  const live = games.filter((g) => g.state === "in").length;
  if (live) return `Week ${week} LIVE: ${live} game${live === 1 ? "" : "s"} in progress`;
  const next = firstPre(games);
  if (!next) return `Week ${week} final`;
  if (games.some((g) => g.state === "post")) return `Week ${week} underway, next game ${formatKickoff(next.kickoff)}`;
  return `Week ${week} kicks off ${formatKickoff(next.kickoff)}`;
}

const record = (s: Standing) => [s.wins, s.losses, ...(s.ties ? [s.ties] : [])].join("-");

// Team names only: a display name is a Sleeper username, and this page is public.
export async function loadOverview(): Promise<Overview> {
  const nfl = await nflState();
  const week = Math.max(1, nfl.week);
  const weeks = Array.from({ length: week }, (_, i) => i + 1);
  const [r, u, rows, games] = await Promise.all([
    rosters(),
    users(),
    Promise.all(weeks.map((w) => leagueMatchups(w, w === week).then((matchups) => ({ week: w, matchups })))),
    getScoreboard(week),
  ]);

  const names = new Map(u.map((user) => [user.user_id, user.metadata?.team_name]));
  const nameOf = (rosterId: number) => {
    const owner = r.find((roster) => roster.roster_id === rosterId)?.owner_id;
    return (owner && names.get(owner)) || `Team ${rosterId}`;
  };

  const standings = sortStandings(r);
  const tally = seasonTally(rows, week, games);
  const pf = Object.fromEntries(standings.map((s) => [s.rosterId, s.pf]));
  const ices = iceStandings(tally, rows.filter((w) => w.week < week), pf, null);
  const top = ices[0];

  const next =
    firstPre(games) ?? (week < REGULAR_SEASON_WEEKS ? firstPre(await getScoreboard(week + 1)) : undefined);
  const [first, bottom] = [standings[0], standings[standings.length - 1]];

  return {
    season: nfl.season,
    week,
    headline: weekHeadline(week, games),
    live: games.some((g) => g.state === "in"),
    leader: { name: nameOf(first.rosterId), record: record(first) },
    last: { name: nameOf(bottom.rosterId), record: record(bottom) },
    iceLeader: top?.total
      ? { name: nameOf(top.rosterId), total: top.total, tied: ices.filter((i) => i.total === top.total).length - 1 }
      : null,
    icesThisWeek: tally.live?.ices.length ?? 0,
    icesLastWeek: tally.weeks.find((w) => w.week === week - 1)?.ices.length ?? null,
    nextKickoff: next ? formatKickoff(next.kickoff) : null,
  };
}
