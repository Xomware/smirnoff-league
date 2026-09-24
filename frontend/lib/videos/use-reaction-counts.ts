"use client";

import { useEffect, useState } from "react";

import { getSocial, REACTIONS } from "@/lib/api/social";

interface Counts {
  byVideo: Record<string, number>;
  failed: number;
}

// There is no batch endpoint, so this asks once per video, and only while the
// page sorts by reactions. A count that fails to load sorts as zero.
export function useReactionCounts(videoIds: string[], enabled: boolean): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(null);
  const key = videoIds.join(",");

  useEffect(() => {
    if (!enabled || !key) return;
    let live = true;
    const ids = key.split(",");
    Promise.all(
      ids.map((id) =>
        getSocial(id).then(
          (s) => REACTIONS.reduce((sum, r) => sum + s.reactions[r].count, 0),
          () => null,
        ),
      ),
    ).then((totals) => {
      if (!live) return;
      setCounts({ byVideo: Object.fromEntries(ids.map((id, i) => [id, totals[i] ?? 0])), failed: totals.filter((t) => t === null).length });
    });
    return () => {
      live = false;
    };
  }, [key, enabled]);

  return enabled ? counts : null;
}
