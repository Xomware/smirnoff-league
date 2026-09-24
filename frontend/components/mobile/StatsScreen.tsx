"use client";

import { useStatsSections } from "@/components/views/stats-view";
import { Tabs } from "@/components/xp/Tabs";
import type { WindowParams } from "@/lib/desktop/windows";

export function StatsScreen({ params }: { params: WindowParams }) {
  const stats = useStatsSections();
  if ("fallback" in stats) return stats.fallback;
  return (
    <div className="m-page">
      <Tabs label="Ice Stats sections" tabs={stats.sections} selected={params.tab} />
    </div>
  );
}
