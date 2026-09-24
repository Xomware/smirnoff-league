import { describe, expect, it } from "vitest";

import type { LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import { readFilters } from "@/lib/filters/filters";
import { clipFields, clipsOf, filterClips } from "./filter";

const ice = (iceId: string, week: number, rosterId: number, reason: LedgerIce["reason"], chugSeconds?: number): LedgerIce => ({
  iceId,
  week,
  rosterId,
  reason,
  status: "completed",
  chugSeconds,
});
const video = (mediaId: string, iceIds: string[], week: number, rosterIds: number[], createdAt: string): Video => ({
  mediaId,
  iceIds,
  week,
  rosterIds,
  createdAt,
  bytes: 1,
  url: `https://media.test/${mediaId}.mp4`,
});

const ICES = [
  ice("W1#R2#ZERO", 1, 2, "zero", 7.4),
  ice("W1#R6#LOWEST", 1, 6, "lowest"),
  ice("W2#R6#EMPTY", 2, 6, "empty", 5.2),
  ice("W2#R12#ZERO#LATE1", 2, 12, "late", 9.9),
  ice("W2#R12#ZERO", 2, 12, "zero"),
];
const VIDEOS = [
  video("a", ["W1#R2#ZERO"], 1, [2], "2026-09-18T12:00:00Z"),
  video("b", ["W1#R6#LOWEST"], 1, [6], "2026-09-19T12:00:00Z"),
  video("c", ["W2#R6#EMPTY"], 2, [6], "2026-09-25T12:00:00Z"),
  video("d", ["W2#R12#ZERO#LATE1"], 2, [12], "2026-09-24T12:00:00Z"),
  video("gone", ["W9#R1#ZERO"], 9, [1], "2026-09-30T12:00:00Z"),
];

const clips = clipsOf(VIDEOS, ICES);
const fields = clipFields(clips, ICES, (r) => `Team ${r}`);
const shown = (param: string, reactions: Record<string, number> = {}) =>
  filterClips(clips, readFilters(fields, param), reactions).map((c) => c.video.mediaId);

describe("chug video filters", () => {
  it("drops videos whose ices the ledger no longer has, and lists newest first", () => {
    expect(shown("")).toEqual(["c", "d", "b", "a"]);
  });

  it("offers each week with its video count and only teams in the ledger", () => {
    const [week, team, type, sort] = fields;
    expect(week.options.map((o) => o.label)).toEqual(["All", "W1 (2)", "W2 (2)"]);
    expect(team.options.map((o) => o.label)).toEqual(["All", "Team 12", "Team 2", "Team 6"]);
    expect(type.options.map((o) => o.label)).toEqual(["All", "Zero", "Empty slot", "Lowest score", "Late"]);
    expect(sort.options.map((o) => o.label)).toEqual(["Newest", "Fastest time", "Most reactions"]);
  });

  it("narrows by week, team and ice type, alone and together", () => {
    expect(shown("week-1")).toEqual(["b", "a"]);
    expect(shown("team-6")).toEqual(["c", "b"]);
    expect(shown("ice-zero")).toEqual(["a"]);
    expect(shown("ice-late")).toEqual(["d"]);
    expect(shown("ice-empty")).toEqual(["c"]);
    expect(shown("week-2.team-6")).toEqual(["c"]);
    expect(shown("week-1.ice-empty")).toEqual([]);
  });

  it("sorts by the fastest timed chug, untimed last", () => {
    expect(shown("sort-fastest")).toEqual(["c", "a", "d", "b"]);
  });

  it("sorts by total reactions, newest first on a tie", () => {
    expect(shown("sort-reactions", { a: 4, b: 1, d: 4 })).toEqual(["d", "a", "b", "c"]);
  });
});
