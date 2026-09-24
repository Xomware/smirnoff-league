"use client";

import { FilterBar, FilterEmpty } from "@/components/filters/FilterBar";
import { NewsList } from "@/components/views/news-list";
import { NewsFeedIcon, WarningIcon } from "@/components/xp/icons";
import type { WindowParams } from "@/lib/desktop/windows";
import { defaultFilters, type FilterField, type FilterValues, plural, readFilters, useFilterParam, writeFilters } from "@/lib/filters/filters";
import { FILTERS, filterFeed, type NewsFilter } from "@/lib/news/feed";
import { useNews } from "@/lib/news/use-news";

export function NewsWindow({ params = {} }: { params?: WindowParams }) {
  const { data, teamFor, week, feed, missing, error } = useNews();
  const [param, setParam] = useFilterParam(params);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !feed) return <p role="status">Rolling the presses...</p>;

  const teams = data.rosters.map((r) => ({ value: String(r.roster_id), label: teamFor(r.roster_id).name })).sort((a, b) => a.label.localeCompare(b.label));
  const fields: FilterField[] = [
    { key: "type", label: "Type", options: Object.entries(FILTERS).map(([value, { label }]) => ({ value, label })) },
    { key: "team", label: "Team", options: [{ value: "all", label: "All" }, ...teams] },
  ];
  const f = readFilters(fields, param);
  const set = (values: FilterValues) => setParam(writeFilters(fields, values));
  const shown = filterFeed(feed, f.type as NewsFilter, f.team === "all" ? null : Number(f.team));
  const filtered = writeFilters(fields, f) !== "";

  return (
    <div className="news">
      <header className="news-masthead">
        <NewsFeedIcon width={32} height={32} className="shrink-0" />
        <div className="min-w-0">
          <h2 className="news-title">The Smirnoff Times</h2>
          <p className="news-dateline">
            {data.league.season} season, Week {week} edition
          </p>
        </div>
      </header>

      <FilterBar fields={fields} values={f} count={plural(shown.length, "item")} onChange={set} />

      {missing.length > 0 && (
        <p role="note" className="xp-note flex items-center gap-1">
          <WarningIcon className="shrink-0" />
          {missing.join(" and ").replace(/^./, (c) => c.toUpperCase())} {missing.length > 1 ? "are" : "is"} unavailable right now.
        </p>
      )}

      <div className="news-inbox xp-inset">
        <div className="news-columns" aria-hidden>
          <span>Headline</span>
          <span>Received</span>
        </div>
        <NewsList label="League news" items={shown} players={data.players} teamFor={teamFor} />
        {shown.length === 0 &&
          (filtered ? (
            <FilterEmpty onClear={() => set(defaultFilters(fields))}>No news matches these filters.</FilterEmpty>
          ) : (
            <p className="news-empty">No news yet.</p>
          ))}
      </div>
    </div>
  );
}
