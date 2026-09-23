"use client";

import { useStatsSections } from "@/components/views/stats-view";
import { JumpSections } from "./JumpSections";

export function StatsScreen() {
  const stats = useStatsSections();
  if ("fallback" in stats) return stats.fallback;
  return (
    <div className="m-page">
      <JumpSections label="Ice Stats sections" sections={stats.sections} />
    </div>
  );
}
