import { describe, expect, it } from "vitest";

import type { LedgerIce } from "@/lib/api/ledger";
import { chuggerRankings, chugsFrom, chugWeeks, rankLabel, sortRankings, summaryCards, weekRankings } from "./chug-rankings";

let n = 0;
const ice = (week: number, rosterId: number, chugSeconds: number | undefined, name?: string): LedgerIce => ({
  iceId: `W${String(week).padStart(2, "0")}#R${String(rosterId).padStart(2, "0")}#S${n++}`,
  week,
  rosterId,
  reason: "zero",
  status: "completed",
  chugSeconds,
  chugger: name ? { name } : undefined,
});

// The reference board: two 8.0s, one chugger with two 10.0s, and a 13.0, all in week 1.
const REFERENCE = [
  ice(1, 3, 8, "Chugger A"),
  ice(1, 5, 8, "Chugger B"),
  ice(1, 7, 10, "Chugger C"),
  ice(1, 7, 10, "Chugger C"),
  ice(1, 9, 13, "Chugger D"),
];

describe("chugsFrom", () => {
  it("keeps only timed ices and falls back to no name", () => {
    const chugs = chugsFrom([ice(1, 2, undefined, "Untimed"), ice(1, 4, 9.4)]);
    expect(chugs).toHaveLength(1);
    expect(chugs[0]).toMatchObject({ week: 1, rosterId: 4, seconds: 9.4, name: null });
  });
});

describe("chuggerRankings", () => {
  it("reproduces the reference: Tied-1, Tied-1, 3, 4", () => {
    const rows = chuggerRankings(chugsFrom(REFERENCE));
    expect(rows.map((r) => [rankLabel(r), r.name, r.pr, r.avg, r.count])).toEqual([
      ["Tied-1", "Chugger A", 8, 8, 1],
      ["Tied-1", "Chugger B", 8, 8, 1],
      ["3", "Chugger C", 10, 10, 2],
      ["4", "Chugger D", 13, 13, 1],
    ]);
  });

  it("takes the minimum as PR and averages to one decimal, half up", () => {
    const [row] = chuggerRankings(chugsFrom([ice(1, 2, 8, "X"), ice(2, 2, 10.9, "X"), ice(3, 2, 12.1, "X")]));
    expect([row.pr, row.avg, row.count]).toEqual([8, 10.3, 3]);
    const [half] = chuggerRankings(chugsFrom([ice(1, 2, 8, "Y"), ice(2, 2, 10.9, "Y")]));
    expect(half.avg).toBe(9.5);
  });

  it("breaks a PR tie by AVG, then by more chugs", () => {
    const rows = chuggerRankings(
      chugsFrom([ice(1, 2, 8, "Slow avg"), ice(2, 2, 12, "Slow avg"), ice(1, 3, 8, "One"), ice(1, 4, 8, "Two"), ice(2, 4, 8, "Two")]),
    );
    expect(rows.map((r) => [rankLabel(r), r.name])).toEqual([
      ["1", "Two"],
      ["2", "One"],
      ["3", "Slow avg"],
    ]);
  });

  it("groups untimed-by-name chugs under their team", () => {
    const rows = chuggerRankings(chugsFrom([ice(1, 6, 9, undefined), ice(2, 6, 11, undefined), ice(1, 6, 7, "Named")]));
    expect(rows.map((r) => [r.name, r.rosterId, r.count])).toEqual([
      ["Named", 6, 1],
      [null, 6, 2],
    ]);
  });
});

describe("weekRankings", () => {
  it("ranks each chug by time with ties: Tied-1, Tied-1, Tied-3, Tied-3, 5", () => {
    expect(weekRankings(chugsFrom(REFERENCE), 1).map((r) => [rankLabel(r), r.name, r.seconds])).toEqual([
      ["Tied-1", "Chugger A", 8],
      ["Tied-1", "Chugger B", 8],
      ["Tied-3", "Chugger C", 10],
      ["Tied-3", "Chugger C", 10],
      ["5", "Chugger D", 13],
    ]);
  });

  it("filters to the week and lists the weeks on record", () => {
    const chugs = chugsFrom([...REFERENCE, ice(3, 2, 9.9, "Later"), ice(2, 2, 11, "Later")]);
    expect(chugWeeks(chugs)).toEqual([1, 2, 3]);
    expect(weekRankings(chugs, 3).map((r) => [rankLabel(r), r.name])).toEqual([["1", "Later"]]);
    expect(weekRankings(chugs, 4)).toEqual([]);
  });
});

describe("summaryCards", () => {
  it("finds the fastest ever, the league average, the most improved and the slowest average", () => {
    const chugs = chugsFrom([
      ...REFERENCE,
      ice(2, 9, 9.5, "Chugger D"),
      ice(3, 7, 10.5, "Chugger C"),
      ice(2, 3, 7.9, "Chugger A"),
    ]);
    const cards = summaryCards(chugs, chuggerRankings(chugs));

    expect(cards.fastest).toMatchObject({ name: "Chugger A", seconds: 7.9, week: 2 });
    expect(cards.average).toBe(9.6);
    expect(cards.count).toBe(8);
    expect(cards.improved).toMatchObject({ row: { name: "Chugger D" }, first: 13, latest: 9.5, drop: 3.5 });
    expect(cards.slowest).toMatchObject({ name: "Chugger D", avg: 11.3 });
  });

  it("names nobody most improved without two chugs that got faster", () => {
    const chugs = chugsFrom([ice(1, 2, 8, "X"), ice(2, 2, 9, "X"), ice(1, 3, 7, "Y")]);
    expect(summaryCards(chugs, chuggerRankings(chugs)).improved).toBeNull();
  });

  it("is empty with no chugs", () => {
    expect(summaryCards([], [])).toEqual({ fastest: null, average: null, count: 0, improved: null, slowest: null });
  });
});

describe("sortRankings", () => {
  const rows = chuggerRankings(chugsFrom(REFERENCE));
  const label = (r: { name: string | null }) => r.name ?? "";
  const team = (id: number) => `Team ${id}`;

  it("sorts by any column and back", () => {
    expect(sortRankings(rows, { key: "count", dir: "desc" }, label, team)[0].name).toBe("Chugger C");
    expect(sortRankings(rows, { key: "chugger", dir: "desc" }, label, team).map((r) => r.name)).toEqual([
      "Chugger D",
      "Chugger C",
      "Chugger B",
      "Chugger A",
    ]);
    expect(sortRankings(rows, { key: "rank", dir: "asc" }, label, team)).toEqual(rows);
  });
});
