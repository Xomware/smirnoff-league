import { describe, expect, it } from "vitest";

import { matchScore, rank } from "./fuzzy";

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("matchScore", () => {
  it("ranks a prefix over a word start over a substring over a scatter", () => {
    const prefix = matchScore("ice", "Ice Rankings");
    const wordStart = matchScore("rank", "Ice Rankings");
    const inside = matchScore("anki", "Ice Rankings");
    const scatter = matchScore("irk", "Ice Rankings");
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(scatter);
    expect(scatter).toBeGreaterThan(0);
  });

  it("scores initials as a word-start match", () => {
    expect(matchScore("is", "Ice Standings")).toBeGreaterThan(matchScore("is", "Chug Videos"));
  });

  it("matches every word of a query at a word start, in any order", () => {
    expect(matchScore("drop news", "News Drop")).toBeGreaterThan(matchScore("week 3", "Week 2: Dom336god vs Team 4"));
  });

  it("ignores case and punctuation", () => {
    expect(matchScore("buckys", "Bucky's Badgers")).toBe(matchScore("bucky", "bucky badgers"));
  });

  it("returns 0 when the letters are not there in order", () => {
    expect(matchScore("zzz", "Ice Rankings")).toBe(0);
    expect(matchScore("sgnikn", "Ice Rankings")).toBe(0);
    expect(matchScore("", "Ice Rankings")).toBe(0);
  });
});

describe("rank", () => {
  const items = [
    { label: "Chug Videos", keywords: ["camcorder"] },
    { label: "Ice Standings" },
    { label: "Ice Rankings", keywords: ["chug rankings", "leaderboard"] },
    { label: "News Drop", keywords: ["edition", "newspaper", "writeup"] },
    { label: "League News" },
  ];

  it("puts the best match first and drops misses", () => {
    expect(labels(rank("rankings", items))).toEqual(["Ice Rankings"]);
    expect(labels(rank("news drop", items))[0]).toBe("News Drop");
    expect(labels(rank("edition", items))).toEqual(["News Drop"]);
  });

  it("prefers the label over a keyword and keeps the given order on a tie", () => {
    expect(labels(rank("chug", items))).toEqual(["Chug Videos", "Ice Rankings"]);
    expect(labels(rank("ice", items))).toEqual(["Ice Standings", "Ice Rankings"]);
  });

  it("drops matches under the floor", () => {
    expect(labels(rank("cvd", items))).toEqual(["Chug Videos"]);
    expect(rank("cvd", items, 11)).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(rank("  ", items)).toEqual([]);
  });
});
