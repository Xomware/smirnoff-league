"use client";

import { useState } from "react";

import { NewsList } from "@/components/views/news-list";
import { NewsFeedIcon, WarningIcon } from "@/components/xp/icons";
import { FILTERS, filterFeed, type NewsFilter } from "@/lib/news/feed";
import { useNews } from "@/lib/news/use-news";

const EMPTY: Record<NewsFilter, string> = {
  all: "No news yet",
  moves: "No transactions yet",
  trades: "No trades yet",
  ices: "No ice events yet",
  writeups: "No news drops yet",
};

export function NewsWindow() {
  const { data, teamFor, week, feed, missing, error } = useNews();
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [rosterId, setRosterId] = useState<number | null>(null);

  if (error) return <p role="alert">Could not reach Sleeper ({error}). Refresh to try again.</p>;
  if (!data || !feed) return <p role="status">Rolling the presses...</p>;

  const shown = filterFeed(feed, filter, rosterId);
  const teams = data.rosters.map((r) => ({ rosterId: r.roster_id, name: teamFor(r.roster_id).name })).sort((a, b) => a.name.localeCompare(b.name));

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

      <div className="news-toolbar">
        <div role="group" aria-label="Show" className="news-chips">
          {(Object.keys(FILTERS) as NewsFilter[]).map((f) => (
            <button key={f} type="button" className="news-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTERS[f].label}
            </button>
          ))}
        </div>
        <label className="news-team">
          Team
          <select
            className="xp-select"
            value={rosterId ?? ""}
            onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.rosterId} value={t.rosterId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {missing.length > 0 && (
        <p role="note" className="xp-note flex items-center gap-1">
          <WarningIcon className="shrink-0" />
          {missing.join(" and ").replace(/^./, (c) => c.toUpperCase())} {missing.length > 1 ? "are" : "is"} unavailable right now.
        </p>
      )}

      <p role="status" className="sr-only">
        {shown.length} {shown.length === 1 ? "item" : "items"}
      </p>
      <div className="news-inbox xp-inset">
        <div className="news-columns" aria-hidden>
          <span>Headline</span>
          <span>Received</span>
        </div>
        <NewsList label="League news" items={shown} players={data.players} teamFor={teamFor} />
        {shown.length === 0 && (
          <p className="news-empty">
            {EMPTY[filter]}
            {rosterId !== null && ` for ${teamFor(rosterId).name}`}.
          </p>
        )}
      </div>
    </div>
  );
}
