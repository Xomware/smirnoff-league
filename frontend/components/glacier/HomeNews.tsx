"use client";

import { useContext } from "react";

import { AwardsCard } from "@/components/home/AwardsCard";
import { DrillContext } from "@/components/views/drill-link";
import { NewsList } from "@/components/views/news-list";
import { MediaPlayerIcon, NewspaperIcon } from "@/components/xp/icons";
import { useNews } from "@/lib/news/use-news";
import { useWriteups } from "@/lib/writeups/use-writeups";
import { Panel } from "./HomePanel";

const NEWS_ITEMS = 3;

const published = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The same sources as the desktop's default windows: the latest News Drop,
// League News and the draft recap.
export function HomeNews() {
  const { data, teamFor, feed, error } = useNews();
  const writeups = useWriteups().state;
  const open = useContext(DrillContext);
  const latest = writeups.status === "ok" ? writeups.writeups[0] : undefined;
  // The edition has its own row above, so the list skips News Drop items.
  const items = feed?.filter((i) => i.event !== "writeup").slice(0, NEWS_ITEMS);

  return (
    <Panel id="home-news" label="News" className="gh-news" all={{ kind: "news" }} more="View more">
      {latest ? (
        <button
          type="button"
          className="gh-card gh-edition"
          aria-label={`News Drop, week ${latest.week}: ${latest.title}`}
          onClick={() => open({ kind: "writeup", week: latest.week })}
        >
          <NewspaperIcon width={28} height={28} className="gh-edition-icon" />
          <span className="gh-edition-text">
            <span className="gh-fact-label">News Drop · Week {latest.week}</span>
            <span className="gh-edition-title">{latest.title}</span>
            <span className="gh-fact-sub">Out {published(latest.publishedAt)}. Read the edition</span>
          </span>
        </button>
      ) : (
        <p className="gh-quiet" role={writeups.status === "loading" ? "status" : undefined}>
          {writeups.status === "loading"
            ? "Fetching the latest News Drop..."
            : writeups.status === "error"
              ? "The News Drop is unavailable right now."
              : "No News Drop has been filed yet."}
        </p>
      )}
      <AwardsCard className="gh-awards" titleClass="gh-fact-label" moreClass="gh-link gh-awards-more" />
      {error ? (
        <p role="alert">Could not load league news ({error}).</p>
      ) : !items || !data ? (
        <p role="status">Reading the wire...</p>
      ) : items.length === 0 ? (
        <p className="gh-quiet">No league news yet.</p>
      ) : (
        <NewsList label="Latest league news" items={items} players={data.players} teamFor={teamFor} />
      )}
      <button type="button" className="gh-card gh-recap" onClick={() => open({ kind: "recap" })}>
        <MediaPlayerIcon width={24} height={24} className="gh-edition-icon" />
        <span className="gh-name">Draft recap</span>
        <span className="gh-card-meta">Watch</span>
      </button>
    </Panel>
  );
}
