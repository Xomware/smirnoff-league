// Deeper Ice Stats (#82). Same inputs as stats.ts: finished weeks only.
import { defaultWeekSettings, type Ice, SLOTS, weekIces } from "./compute";
import { type PositionOf, type StatsMatchup, type StatsWeek, withDef } from "./stats";

export interface WinLoss {
  wins: number;
  games: number;
}

export interface Benched {
  playerId: string;
  position: string;
  points: number;
}

export interface BenchWeek {
  week: number;
  actual: number;
  optimal: number;
  left: number;
  benched: Benched[];
}

export interface Game {
  winner: number;
  loser: number;
  winnerPoints: number;
  loserPoints: number;
  margin: number;
}

// Most recent week first.
export const HEAT_WEIGHTS = [3, 2, 1];
export const RISK_SLOTS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
const FLEX = new Set(["RB", "WR", "TE", "FLEX"]);

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const byWeek = (weeks: StatsWeek[]) => [...weeks].sort((a, b) => a.week - b.week);
const known = (w: StatsWeek) => w.matchups.filter((m) => m.starters !== null);
const icesOf = (w: StatsWeek) => weekIces(w.week, w.matchups, SLOTS, defaultWeekSettings(w.week));
// A lowest-score ice follows from the score, so it would skew anything compared with results or starts.
const slotIces = (w: StatsWeek) => icesOf(w).filter((i) => i.reason !== "lowest");
const count = (ices: Ice[], rosterId: number) => ices.filter((i) => i.rosterId === rosterId).length;
const rosterIds = (weeks: StatsWeek[]) => [...new Set(weeks.flatMap((w) => known(w).map((m) => m.roster_id)))];

export function iceRace(weeks: StatsWeek[]) {
  const sorted = byWeek(weeks);
  const perWeek = sorted.map(icesOf);
  const teams = rosterIds(sorted).map((rosterId) => {
    let total = 0;
    const cumulative = perWeek.map((ices) => (total += count(ices, rosterId)));
    return { rosterId, cumulative, total };
  });
  return { weeks: sorted.map((w) => w.week), teams: teams.sort((a, b) => b.total - a.total || a.rosterId - b.rosterId) };
}

export function iceRate(weeks: StatsWeek[]) {
  const ices = weeks.flatMap(slotIces);
  const teams = rosterIds(weeks).map((rosterId) => {
    const starts = SLOTS.length * weeks.filter((w) => known(w).some((m) => m.roster_id === rosterId)).length;
    const n = count(ices, rosterId);
    return { rosterId, ices: n, starts, rate: n / starts };
  });
  const starts = sum(teams.map((t) => t.starts));
  return {
    teams: teams.sort((a, b) => b.rate - a.rate || a.rosterId - b.rosterId),
    league: starts ? ices.length / starts : 0,
  };
}

// Greedy is optimal here: each fixed slot takes one position, and FLEX only
// draws from what the fixed slots leave. A FLEX starter with no known
// position can only go back in FLEX; a fixed-slot starter is that slot.
export function lineupWeek(week: number, m: StatsMatchup, positionOf: PositionOf): BenchWeek {
  const starters = m.starters!;
  const pool: Benched[] = [];
  SLOTS.forEach((slot, i) => {
    const id = starters[i];
    if (id === undefined || id === "0") return;
    pool.push({ playerId: id, points: m.starters_points[i], position: slot === "FLEX" ? (positionOf(id) ?? "FLEX") : slot });
  });
  for (const id of m.players ?? []) {
    const position = positionOf(id);
    if (!starters.includes(id) && position) pool.push({ playerId: id, points: m.players_points?.[id] ?? 0, position });
  }
  pool.sort((a, b) => b.points - a.points);

  const chosen = new Set<Benched>();
  for (const slot of [...SLOTS.filter((s) => s !== "FLEX"), "FLEX", "FLEX"]) {
    const fits = (p: Benched) => (slot === "FLEX" ? FLEX.has(p.position) : p.position === slot);
    const pick = pool.find((p) => !chosen.has(p) && fits(p));
    if (pick) chosen.add(pick);
  }
  const actual = round2(sum(m.starters_points.slice(0, SLOTS.length).filter((p) => p !== undefined)));
  const optimal = round2(sum([...chosen].map((p) => p.points)));
  return {
    week,
    actual,
    optimal,
    left: round2(optimal - actual),
    benched: pool.filter((p) => chosen.has(p) && !starters.includes(p.playerId)),
  };
}

export function benchPoints(weeks: StatsWeek[], positionOf: PositionOf) {
  const posOf = withDef(positionOf);
  const rows = byWeek(weeks).flatMap((w) => known(w).map((m) => ({ rosterId: m.roster_id, week: lineupWeek(w.week, m, posOf) })));
  return rosterIds(weeks)
    .map((rosterId) => {
      const mine = rows.filter((r) => r.rosterId === rosterId).map((r) => r.week);
      const worst = mine.reduce((a, b) => (b.left > a.left ? b : a));
      return { rosterId, total: round2(sum(mine.map((w) => w.left))), weeks: mine, worst };
    })
    .sort((a, b) => b.total - a.total || a.rosterId - b.rosterId);
}

function games(w: StatsWeek): Game[] {
  const byMatchup = new Map<number, StatsMatchup[]>();
  for (const m of known(w)) {
    if (m.matchup_id !== null) byMatchup.set(m.matchup_id, [...(byMatchup.get(m.matchup_id) ?? []), m]);
  }
  return [...byMatchup.values()]
    .filter((pair) => pair.length === 2)
    .map((pair) => {
      const [hi, lo] = [...pair].sort((a, b) => b.points - a.points);
      return { winner: hi.roster_id, loser: lo.roster_id, winnerPoints: hi.points, loserPoints: lo.points, margin: round2(hi.points - lo.points) };
    });
}

export function icesVsResults(weeks: StatsWeek[]) {
  const blank = () => ({ iced: { wins: 0, games: 0 }, clean: { wins: 0, games: 0 } });
  const league = blank();
  const teams = new Map(rosterIds(weeks).map((id) => [id, blank()]));
  for (const w of weeks) {
    const iced = new Set(slotIces(w).map((i) => i.rosterId));
    for (const g of games(w)) {
      const win = g.margin === 0 ? 0.5 : 1;
      for (const [rosterId, wins] of [[g.winner, win], [g.loser, 1 - win]]) {
        const key = iced.has(rosterId) ? "iced" : "clean";
        for (const r of [league[key], teams.get(rosterId)![key]]) {
          r.wins += wins;
          r.games += 1;
        }
      }
    }
  }
  return { league, teams: [...teams].map(([rosterId, r]) => ({ rosterId, ...r })) };
}

export function positionRisk(weeks: StatsWeek[]) {
  const ices = weeks.flatMap(slotIces);
  const rosterWeeks = sum(weeks.map((w) => known(w).length));
  return RISK_SLOTS.map((slot) => {
    const starts = rosterWeeks * SLOTS.filter((s) => s === slot).length;
    const n = ices.filter((i) => i.slot === slot).length;
    return { slot, starts, ices: n, rate: starts ? n / starts : 0 };
  });
}

export function weeklyExtremes(weeks: StatsWeek[]) {
  return byWeek(weeks).map((w) => {
    const scores = known(w)
      .map((m) => ({ rosterId: m.roster_id, points: m.points }))
      .sort((a, b) => b.points - a.points);
    const gs = [...games(w)].sort((a, b) => b.margin - a.margin);
    return { week: w.week, high: scores[0], low: scores[scores.length - 1], blowout: gs[0], closest: gs[gs.length - 1] };
  });
}

export function heatCheck(weeks: StatsWeek[]) {
  const recentWeeks = byWeek(weeks).reverse().slice(0, HEAT_WEIGHTS.length).map(icesOf);
  return rosterIds(weeks)
    .map((rosterId) => {
      const recent = recentWeeks.map((ices) => count(ices, rosterId));
      return { rosterId, score: sum(recent.map((n, i) => n * HEAT_WEIGHTS[i])), recent };
    })
    .sort((a, b) => b.score - a.score || a.rosterId - b.rosterId);
}

export function iceAnalysis(weeks: StatsWeek[], positionOf: PositionOf) {
  const all = weeks.flatMap(icesOf);
  return {
    reasons: { zero: all.filter((i) => i.reason === "zero").length, total: all.length },
    race: iceRace(weeks),
    rate: iceRate(weeks),
    bench: benchPoints(weeks, positionOf),
    results: icesVsResults(weeks),
    positions: positionRisk(weeks),
    extremes: weeklyExtremes(weeks),
    heat: heatCheck(weeks),
  };
}

export type IceAnalysis = ReturnType<typeof iceAnalysis>;

export const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
export const winPct = (r: WinLoss) => (r.games ? `${Math.round((r.wins / r.games) * 100)}%` : "n/a");
const ices = (n: number) => `${n} ${n === 1 ? "ice" : "ices"}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function takeaways(a: IceAnalysis, name: (rosterId: number) => string) {
  const [first, second] = a.race.teams;
  const leaders = a.race.teams.filter((t) => t.total === first?.total);
  const race =
    !first || first.total === 0
      ? "Nobody has iced yet."
      : leaders.length > 1
        ? `${list(leaders.map((t) => name(t.rosterId)))} are tied for the lead on ${ices(first.total)}.`
        : `${name(first.rosterId)} leads the race on ${ices(first.total)}, ${first.total - (second?.total ?? 0)} clear of the field.`;

  const perWeek = a.race.weeks.map((week, i) => ({
    week,
    n: sum(a.race.teams.map((t) => t.cumulative[i] - (t.cumulative[i - 1] ?? 0))),
  }));
  const iciest = [...perWeek].sort((x, y) => y.n - x.n || x.week - y.week)[0];
  const weeks = iciest?.n ? `W${iciest.week} was the iciest week, with ${ices(iciest.n)}.` : "Nobody has iced yet.";

  const reasons = a.reasons.total
    ? `Zeroed starters caused ${a.reasons.zero} of the ${ices(a.reasons.total)}; the rest were empty slots and lowest scores.`
    : "Nobody has iced yet.";

  const top = a.rate.teams[0];
  const rate =
    !top || top.ices === 0
      ? "No slot has iced yet."
      : `${name(top.rosterId)} ices ${pct(top.rate)} of starts, ${(top.rate / a.rate.league).toFixed(1)}x the league average of ${pct(a.rate.league)}.`;

  const coach = a.bench[0];
  const bench =
    !coach || coach.total <= 0
      ? "Every lineup was optimal. Nobody left a point on the bench."
      : `${name(coach.rosterId)} has left ${coach.total.toFixed(1)} points on the bench, ${coach.worst.left.toFixed(1)} of it in W${coach.worst.week}.`;

  const { iced, clean } = a.results.league;
  const results = iced.games
    ? `Teams win ${winPct(iced)} of weeks with a slot ice and ${winPct(clean)} of weeks without.`
    : "No slot ice yet, so no win rate to compare.";

  const risky = [...a.positions].sort((x, y) => y.rate - x.rate);
  const safe = a.positions.filter((p) => p.ices === 0).map((p) => p.slot);
  const low = risky.filter((p) => p.ices > 0).at(-1)!;
  const positions =
    risky[0].ices === 0
      ? "No slot has iced yet."
      : safe.length
        ? `${risky[0].slot} slots ice ${pct(risky[0].rate)} of the time, while ${list(safe)} slots have yet to ice.`
        : `${risky[0].slot} slots ice ${(risky[0].rate / low.rate).toFixed(1)}x as often as ${low.slot} slots.`;

  const blowout = a.extremes
    .filter((e) => e.blowout)
    .sort((x, y) => y.blowout.margin - x.blowout.margin || x.week - y.week)[0];
  const extremes = blowout
    ? `Biggest blowout: ${name(blowout.blowout.winner)} over ${name(blowout.blowout.loser)} by ${blowout.blowout.margin.toFixed(1)} in W${blowout.week}.`
    : "No games finished yet.";

  const hot = a.heat[0];
  const heat =
    !hot || hot.score === 0
      ? `Nobody has iced in the last ${HEAT_WEIGHTS.length} weeks.`
      : `${name(hot.rosterId)} is most likely to ice next, with ${ices(sum(hot.recent))} in the last ${HEAT_WEIGHTS.length} weeks.`;

  return { race, weeks, reasons, rate, bench, results, positions, extremes, heat };
}
