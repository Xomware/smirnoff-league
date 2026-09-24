"use client";

import { useMemo } from "react";

import { chugTime } from "@/components/videos/ChugTime";
import { heatCheck, weeklyExtremes } from "@/lib/ices/analysis";
import { chuggerRankings, chugsFrom, summaryCards } from "@/lib/ices/chug-rankings";
import { iceStandings, weekIceStandings } from "@/lib/ices/standings";
import { iceStreaks } from "@/lib/ices/stats";
import { useLedger } from "@/lib/ices/use-ledger";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useTrouble } from "@/lib/ices/use-trouble";
import { punishmentRisk, toiletBowl } from "@/lib/league/brackets";
import { type Standing, sortStandings } from "@/lib/league/standings";
import { useLeague } from "@/lib/league/use-league";
import type { useWeekGames } from "@/lib/league/use-week-games";
import type { Fact } from "./Spotlight";

export interface Hitters {
  ices: Fact[];
  league: Fact[];
  chugs: Fact[];
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
export const record = (s: Standing) => `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`;

// Every number here comes from the same helpers the stats, standings and
// bracket pages use, so a fact always matches the page its View more opens.
export function useHitters(week: number | undefined, games: ReturnType<typeof useWeekGames>): Hitters | null {
  const { data, teamFor } = useLeague();
  const current = data ? Math.max(1, data.nfl.week) : undefined;
  const { tally, finishedWeeks, liveMatchups } = useSeasonIces(current);
  const ledger = useLedger();
  const trouble = useTrouble();

  return useMemo(() => {
    if (!data || !tally || !finishedWeeks || !liveMatchups || week === undefined || ledger.status === "loading") return null;
    const name = (rosterId: number) => teamFor(rosterId).name;
    const ok = ledger.status === "ok" ? ledger.ledger : null;
    const standings = sortStandings(data.rosters);
    const seeds = standings.map((s) => s.rosterId);

    const ices: Fact[] = [];
    const mostIn = (w: number) => {
      const live = w === current;
      const weekIces = live ? tally.live : tally.weeks.find((x) => x.week === w);
      const matchups = live ? liveMatchups : finishedWeeks.find((x) => x.week === w)?.matchups;
      if (!weekIces || !matchups) return;
      const top = weekIceStandings(seeds, weekIces, matchups, live, ok)[0];
      const iced = top && top.total > 0;
      ices.push({
        id: `week-${w}`,
        label: `Most ices, week ${w}`,
        value: iced ? name(top.rosterId) : "Nobody",
        sub: iced ? `${plural(top.total, "ice")}${live ? " so far" : ""}` : "A clean week",
        to: { kind: "week", week: w },
      });
    };
    mostIn(week);
    if (week > 1) mostIn(week - 1);

    const pf = Object.fromEntries(standings.map((s) => [s.rosterId, s.pf]));
    const season = iceStandings(tally, finishedWeeks, pf, ok?.summary ?? null)[0];
    if (season?.total) {
      ices.push({ id: "season", label: "Most ices, season", value: name(season.rosterId), sub: plural(season.total, "ice"), to: { kind: "ice-standings" } });
    }
    const heat = heatCheck(finishedWeeks)[0];
    if (heat?.score) {
      const iced = heat.recent.filter((n) => n > 0).length;
      const sub = `Iced in ${iced} of the last ${plural(heat.recent.length, "week")}`;
      ices.push({ id: "heat", label: "Most likely to ice next", value: name(heat.rosterId), sub, to: { kind: "stats" } });
    }
    const streak = iceStreaks(finishedWeeks)[0];
    if (streak?.longest) {
      const sub = `${plural(streak.longest, "week")} in a row${streak.current === streak.longest ? ", still going" : ""}`;
      ices.push({ id: "streak", label: "Longest ice streak", value: name(streak.rosterId), sub, to: { kind: "stats" } });
    }

    const league: Fact[] = [];
    const lowest = games.live && games.liveGames > 0 ? games.games?.flatMap((g) => g.sides).find((s) => trouble.of(s.rosterId).includes("lowest")) : undefined;
    if (lowest) {
      const sub = `${lowest.points.toFixed(2)} points, games live`;
      league.push({ id: "lowest", label: "Lowest score right now", value: name(lowest.rosterId), sub, to: { kind: "watch" } });
    }
    const line = (s: Standing) => `${record(s)} · ${s.pf.toFixed(2)} PF`;
    league.push(
      { id: "leader", label: "Standings leader", value: name(standings[0].rosterId), sub: line(standings[0]), to: { kind: "standings" } },
      { id: "last", label: "Last place", value: name(standings.at(-1)!.rosterId), sub: line(standings.at(-1)!), to: { kind: "standings" } },
    );
    // Before the playoffs this is seeds 9-14 in order, so its head is the toilet-bowl team nearest safety.
    const risk = punishmentRisk(toiletBowl(seeds, null))[0];
    if (risk !== undefined) {
      const sub = `Seed ${seeds.indexOf(risk) + 1}, first team in the toilet bowl`;
      league.push({ id: "toilet", label: "Toilet bowl risk", value: name(risk), sub, to: { kind: "brackets" } });
    }
    const x = weeklyExtremes(finishedWeeks).at(-1);
    if (x) {
      const to = { kind: "week", week: x.week } as const;
      league.push(
        { id: "high", label: `High score, week ${x.week}`, value: name(x.high.rosterId), sub: `${x.high.points.toFixed(2)} points`, to },
        {
          id: "blowout",
          label: `Biggest blowout, week ${x.week}`,
          value: name(x.blowout.winner),
          sub: `beat ${name(x.blowout.loser)} by ${x.blowout.margin.toFixed(2)}`,
          to,
        },
      );
    }

    const chugs: Fact[] = [];
    if (ok) {
      const timed = chugsFrom(ok.ices);
      const { fastest, slowest } = summaryCards(timed, chuggerRankings(timed));
      if (fastest) {
        const sub = `${chugTime(fastest.seconds)} in week ${fastest.week}`;
        chugs.push({ id: "fastest", label: "Fastest chug", value: fastest.name ?? name(fastest.rosterId), sub, to: { kind: "chug-rankings" } });
      }
      if (slowest && timed.length > 1) {
        const sub = `${chugTime(slowest.avg)} on average`;
        chugs.push({ id: "slowest", label: "Slowest chug", value: slowest.name ?? name(slowest.rosterId), sub, to: { kind: "chug-rankings" } });
      }
      const owing = (s: (typeof ok.summary)[number]) => s.owed + s.lateOwed;
      const most = [...ok.summary].sort((a, b) => owing(b) - owing(a))[0];
      const n = most ? owing(most) : 0;
      chugs.push({
        id: "owes",
        label: "Owes the most",
        value: n ? name(most.rosterId) : "Nobody",
        sub: n ? `${n} owed` : "Everyone is paid up",
        to: { kind: "ices" },
      });
    }
    return { ices, league, chugs };
  }, [data, tally, finishedWeeks, liveMatchups, week, current, ledger, games, trouble, teamFor]);
}
