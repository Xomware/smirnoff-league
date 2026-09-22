import type { SleeperBracketMatch, SleeperMatchup, SleeperNflState } from "@/lib/sleeper/types";

export interface Slot {
  rosterId: number | null;
  seed: number | null;
  // Which earlier game feeds this slot, e.g. "Loser of game 1".
  from: string | null;
}

export interface Match {
  id: number;
  round: number;
  a: Slot;
  b: Slot;
  winner: number | null;
  loser: number | null;
}

export interface Bracket {
  rounds: Match[][];
  byes: Slot[];
}

export interface ToiletBowl extends Bracket {
  punished: number | null;
}

export interface ToiletConfig {
  byes: number[];
}

// Stored as TOILET_BRACKET in smirnoff-settings once the admin API exists.
export const DEFAULT_TOILET_CONFIG: ToiletConfig = { byes: [13, 14] };

const TOILET_SEEDS = [9, 10, 11, 12, 13, 14];

const slotFor = (seeds: number[], seed: number): Slot => ({
  rosterId: seeds[seed - 1] ?? null,
  seed,
  from: null,
});

const tbd = (from: string): Slot => ({ rosterId: null, seed: null, from });

// Ties and missing rows stay unresolved: Sleeper's tiebreak is unknown.
function play(id: number, round: number, a: Slot, b: Slot, results: SleeperMatchup[][]): Match {
  const rows = results[round - 1] ?? [];
  const pts = (s: Slot) => rows.find((r) => r.roster_id === s.rosterId)?.points;
  const pa = pts(a);
  const pb = pts(b);
  const match = { id, round, a, b, winner: null, loser: null };
  if (pa === undefined || pb === undefined || pa === pb) return match;
  const [w, l] = pa > pb ? [a, b] : [b, a];
  return { ...match, winner: w.rosterId, loser: l.rosterId };
}

function advance(m: Match, side: "winner" | "loser", seeds: number[]): Slot {
  const id = m[side];
  const from = `${side === "winner" ? "Winner" : "Loser"} of game ${m.id}`;
  if (id === null) return tbd(from);
  return { rosterId: id, seed: seeds.indexOf(id) + 1, from };
}

// Standard 8-team format, no reseeding.
export function projectedPlayoffBracket(seeds: number[]): Bracket {
  const r1 = [
    [1, 8],
    [4, 5],
    [3, 6],
    [2, 7],
  ].map(([a, b], i) => play(i + 1, 1, slotFor(seeds, a), slotFor(seeds, b), []));
  const semi = (i: number) =>
    play(5 + i, 2, advance(r1[2 * i], "winner", seeds), advance(r1[2 * i + 1], "winner", seeds), []);
  const semis = [semi(0), semi(1)];
  const final = play(7, 3, advance(semis[0], "winner", seeds), advance(semis[1], "winner", seeds), []);
  return { rounds: [r1, semis, [final]], byes: [] };
}

export function fromSleeper(bracket: SleeperBracketMatch[], seeds: number[]): Bracket {
  const from = (f: SleeperBracketMatch["t1_from"]) =>
    f?.w ? `Winner of game ${f.w}` : f?.l ? `Loser of game ${f.l}` : null;
  const slot = (id: number | null, f: SleeperBracketMatch["t1_from"]): Slot => ({
    rosterId: id,
    seed: id === null ? null : seeds.indexOf(id) + 1 || null,
    from: from(f),
  });

  const rounds: Match[][] = [];
  for (const g of [...bracket].sort((x, y) => x.r - y.r || x.m - y.m)) {
    (rounds[g.r - 1] ??= []).push({
      id: g.m,
      round: g.r,
      a: slot(g.t1, g.t1_from),
      b: slot(g.t2, g.t2_from),
      winner: g.w,
      loser: g.l,
    });
  }
  // A known team entering after round 1 with no feeder game had a bye.
  const byes = rounds
    .slice(1)
    .flat()
    .flatMap((m) => [m.a, m.b])
    .filter((s) => s.rosterId !== null && s.from === null)
    .sort((x, y) => (x.seed ?? 0) - (y.seed ?? 0));
  return { rounds: rounds.filter(Boolean), byes };
}

// Loser advances over seeds 9-14: round-1 losers meet the bye teams, and the
// loser of the final has lost every game it played.
export function toiletBowl(
  seeds: number[],
  losersBracket: SleeperBracketMatch[] | null,
  results: SleeperMatchup[][] = [],
  config: ToiletConfig = DEFAULT_TOILET_CONFIG,
): ToiletBowl {
  if (losersBracket?.length) {
    const b = fromSleeper(losersBracket, seeds);
    // Assumes Sleeper marks the last-place game p=1, as it does the title game.
    const last = losersBracket.find((g) => g.p === 1);
    return { ...b, punished: last?.l ?? null };
  }

  const open = TOILET_SEEDS.filter((s) => !config.byes.includes(s));
  const byes = [...config.byes].sort((x, y) => x - y).map((s) => slotFor(seeds, s));
  const r1 = [
    play(1, 1, slotFor(seeds, open[0]), slotFor(seeds, open[3]), results),
    play(2, 1, slotFor(seeds, open[1]), slotFor(seeds, open[2]), results),
  ];
  const r2 = r1.map((m, i) => play(3 + i, 2, advance(m, "loser", seeds), byes[i], results));
  const final = play(5, 3, advance(r2[0], "loser", seeds), advance(r2[1], "loser", seeds), results);
  return { rounds: [r1, r2, [final]], byes, punished: final.loser };
}

// A win gets you out of a loser-advances bracket. Before week 15 nobody has
// played, so this is simply seeds 9-14: the bottom 6 by standings.
export function punishmentRisk(bowl: Bracket): number[] {
  const matches = bowl.rounds.flat();
  const winners = new Set(matches.map((m) => m.winner));
  const seen = new Map<number, number>();
  for (const s of [...matches.flatMap((m) => [m.a, m.b]), ...bowl.byes]) {
    if (s.rosterId !== null && !winners.has(s.rosterId)) seen.set(s.rosterId, s.seed ?? 99);
  }
  return [...seen].sort((x, y) => x[1] - y[1]).map(([id]) => id);
}

// The last fantasy week whose results are final, for the league's season.
export function lastFinishedWeek(nfl: SleeperNflState, season: string): number {
  if (nfl.season > season) return Infinity;
  if (nfl.season < season || nfl.season_type === "pre") return 0;
  return nfl.season_type === "regular" ? nfl.week - 1 : Infinity;
}
