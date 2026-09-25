"use client";

import Image from "next/image";
import { useContext } from "react";

import { AwardsCard } from "@/components/home/AwardsCard";
import { DueCard } from "@/components/home/DueCard";
import { DrillContext, DrillLink } from "@/components/views/drill-link";
import { useLedger } from "@/lib/ices/use-ledger";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useWeekGames } from "@/lib/league/use-week-games";
import { useVideos } from "@/lib/videos/use-videos";
import { useWriteups } from "@/lib/writeups/use-writeups";
import { ChugBoardCards, ChugReelRow } from "./ChugCards";
import { MatchupCard } from "./MatchupCard";
import { YourIces } from "./YourIces";

function WeekMatchups({ week }: { week: number | undefined }) {
  const { data, games, teamFor, error } = useWeekGames(week);
  return (
    <section aria-labelledby="m-home-games" className="m-section">
      <div className="m-section-head">
        <h2 id="m-home-games" className="m-section-title">
          {week === undefined ? "This week" : `Week ${week} matchups`}
        </h2>
        <DrillLink to={{ kind: "watch" }}>All games</DrillLink>
      </div>
      {error ? (
        <p role="alert">Could not reach Sleeper ({error}).</p>
      ) : !data || !games || week === undefined ? (
        <p role="status">Loading the matchups...</p>
      ) : games.length === 0 ? (
        <p className="m-empty">No matchups yet this week.</p>
      ) : (
        <ul aria-label="This week's matchups" className="m-hscroll">
          {games.map((game) => (
            <li key={game.id}>
              <MatchupCard week={week} game={game} players={data.players} teamFor={teamFor} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditionCard() {
  const { state, onPageError } = useWriteups();
  const open = useContext(DrillContext);
  const latest = state.status === "ok" ? state.writeups[0] : undefined;

  return (
    <section aria-labelledby="m-edition" className="m-section">
      <h2 id="m-edition" className="m-section-title">
        News Drop
      </h2>
      {state.status === "loading" ? (
        <p role="status">Checking the News Drop...</p>
      ) : state.status === "error" ? (
        <p role="alert">News Drop unavailable.</p>
      ) : !latest ? (
        <p className="m-empty">No edition yet. The commish is typing...</p>
      ) : (
        <button type="button" className="m-card m-edition" onClick={() => open({ kind: "writeup", week: latest.week })}>
          <Image unoptimized src={latest.pages[0]} alt="" width={96} height={124} onError={onPageError} />
          <span className="grid content-center gap-1">
            <span className="m-kicker">Week {latest.week} edition</span>
            <span className="m-edition-title">{latest.title}</span>
            <span className="m-link">Read it</span>
          </span>
        </button>
      )}
    </section>
  );
}

export function HomeScreen() {
  const week = useDefaultWeek();
  const ledger = useLedger();
  const { state: videos, onVideoError } = useVideos();

  return (
    <div className="m-page">
      <section aria-label="This week" className="m-hero">
        <Image src="/brand/mascot.png" alt="The league mascot, a robot chugging a Smirnoff Ice" width={84} height={92} priority />
        <div>
          <p className="m-kicker">Smirnoff League</p>
          <p className="m-hero-week">{week === undefined ? "Loading..." : `Week ${week}`}</p>
          <p className="m-hero-sub">Stay hydrated. Stay iced.</p>
        </div>
      </section>
      <DueCard className="m-section" titleClass="m-section-title" Heading="h2" />
      <YourIces />
      {ledger.status === "ok" && (
        <ChugBoardCards ledger={ledger.ledger} videos={videos.status === "ok" ? videos.videos : []} onVideoError={onVideoError} />
      )}
      <WeekMatchups week={week} />
      <EditionCard />
      <AwardsCard className="m-section m-awards" titleClass="m-section-title" Heading="h2" />
      {ledger.status === "ok" && <ChugReelRow ledger={ledger.ledger} videos={videos} onVideoError={onVideoError} />}
    </div>
  );
}
