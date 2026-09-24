import type { LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import type { FilterField, FilterValues } from "@/lib/filters/filters";

// A video with the ledger ices it covers.
export interface Clip {
  video: Video;
  covered: LedgerIce[];
}

const ALL = { value: "all", label: "All" };

// A video whose ices the ledger no longer holds (voided) has nothing to show under.
export function clipsOf(videos: Video[], ices: LedgerIce[]): Clip[] {
  const byId = new Map(ices.map((i) => [i.iceId, i]));
  return videos.map((video) => ({ video, covered: video.iceIds.flatMap((id) => byId.get(id) ?? []) })).filter((c) => c.covered.length > 0);
}

// Weeks and teams come from `ices`, so a page listing owed ices too can filter
// weeks and teams with no video yet; each week counts its videos.
export function clipFields(clips: Clip[], ices: LedgerIce[], teamName: (rosterId: number) => string): FilterField[] {
  const weeks = [...new Set(ices.map((i) => i.week))].sort((a, b) => a - b);
  const teams = [...new Set(ices.map((i) => i.rosterId))].sort((a, b) => teamName(a).localeCompare(teamName(b)));
  return [
    {
      key: "week",
      label: "Week",
      options: [ALL, ...weeks.map((w) => ({ value: String(w), label: `W${w} (${clips.filter((c) => c.video.week === w).length})` }))],
    },
    { key: "team", label: "Team", options: [ALL, ...teams.map((r) => ({ value: String(r), label: teamName(r) }))] },
    {
      key: "ice",
      label: "Ice type",
      options: [ALL, { value: "zero", label: "Zero" }, { value: "empty", label: "Empty slot" }, { value: "lowest", label: "Lowest score" }, { value: "late", label: "Late" }],
    },
    {
      key: "sort",
      label: "Sort",
      options: [
        { value: "newest", label: "Newest" },
        { value: "fastest", label: "Fastest time" },
        { value: "reactions", label: "Most reactions" },
      ],
    },
  ];
}

export const iceMatches = (ice: LedgerIce, f: FilterValues) =>
  (f.week === "all" || ice.week === Number(f.week)) && (f.team === "all" || ice.rosterId === Number(f.team)) && (f.ice === "all" || ice.reason === f.ice);

// Untimed videos sort after every timed one.
const fastest = (c: Clip) => Math.min(...c.covered.map((i) => i.chugSeconds ?? Number.MAX_VALUE));

export function filterClips(clips: Clip[], f: FilterValues, reactions: Record<string, number>): Clip[] {
  const newest = (a: Clip, b: Clip) => b.video.createdAt.localeCompare(a.video.createdAt);
  const count = (c: Clip) => reactions[c.video.mediaId] ?? 0;
  const order = {
    newest,
    fastest: (a: Clip, b: Clip) => fastest(a) - fastest(b) || newest(a, b),
    reactions: (a: Clip, b: Clip) => count(b) - count(a) || newest(a, b),
  }[f.sort as "newest" | "fastest" | "reactions"];
  return clips.filter((c) => c.covered.some((i) => iceMatches(i, f))).sort(order);
}
