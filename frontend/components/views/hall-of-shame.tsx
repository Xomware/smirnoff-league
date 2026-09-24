import { type CSSProperties, Fragment, type ReactNode, useId } from "react";

import type { iceStats } from "@/lib/ices/stats";
import { BoardHead } from "./board";
import { DrillLink } from "./drill-link";

export type IceStats = ReturnType<typeof iceStats>;

interface HallOfShameProps {
  stats: IceStats;
  teamName: (rosterId: number) => string;
  playerName: (playerId: string) => string;
}

interface ShameCardProps {
  title: string;
  empty: string;
  items: ReactNode[];
  className?: string;
  // A board's column labels and widths; cards without them list prose.
  board?: { labels: string[]; cols: string };
}

const pts = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ShameCard({ title, empty, items, className = "", board }: ShameCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`xp-dialog ${className}`}>
      <h3 id={id} className="xp-dialog-title">{title}</h3>
      {items.length === 0 ? (
        <p className="p-3">{empty}</p>
      ) : board ? (
        <div style={{ "--board-cols": board.cols } as CSSProperties}>
          <BoardHead labels={board.labels} numbersFrom={1} />
          <ul>{items}</ul>
        </div>
      ) : (
        <ul className="grid gap-1 p-2">{items}</ul>
      )}
    </section>
  );
}

export function HallOfShame({ stats, teamName, playerName }: HallOfShameProps) {
  const team = (rosterId: number) => <DrillLink to={{ kind: "team", rosterId }}>{teamName(rosterId)}</DrillLink>;
  const player = (playerId: string) => <DrillLink to={{ kind: "player", playerId }}>{playerName(playerId)}</DrillLink>;
  const teams = (ids: number[]) =>
    ids.map((id, i) => (
      <Fragment key={id}>
        {i > 0 && ", "}
        {team(id)}
      </Fragment>
    ));
  const row = "flex flex-col gap-0.5 border-b border-(--xp-face-shadow) px-1 pb-1 last:border-0";
  const name = (who: ReactNode) => (
    <span className="board-who">
      <span className="board-name">{who}</span>
    </span>
  );
  const num = (n: number, spoken: string) => (
    <span className="board-num">
      {n}
      <span className="sr-only"> {spoken}</span>
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ShameCard
        title="Most Wanted"
        className="xp-wanted"
        empty="No repeat offenders yet. Every dud has only let a team down once."
        items={stats.repeatOffenders.map((o) => (
          <li key={o.playerId} className="xp-wanted-poster">
            <span className="xp-wanted-head">Wanted</span>
            <span className="text-base font-bold">{player(o.playerId)}</span>
            <span>caused {plural(o.count, "ice")}</span>
            <span className="text-xs">Started by {teams(o.rosterIds)}</span>
          </li>
        ))}
      />
      <ShameCard
        title="Avoidable Ices"
        empty="Nobody has benched the better player yet. Give it a week."
        items={stats.avoidable.slice(0, 10).map((a) => (
          <li key={a.ice.id} className={row}>
            <span className="font-bold">Left {pts(a.points)} on the bench and chugged anyway</span>
            <span>
              {team(a.ice.rosterId)}, W{a.ice.week}: started {player(a.ice.playerId!)} over {player(a.playerId)}
            </span>
          </li>
        ))}
      />
      <ShameCard
        title="Closest Escapes"
        empty="Nobody has scraped by on a single point. Yet."
        board={{ labels: ["Player", "Pts"], cols: "minmax(0, 1fr) 3rem" }}
        items={stats.closestEscapes.slice(0, 10).map((e) => (
          <li key={`${e.week}-${e.rosterId}-${e.slotIndex}`} className="board-row">
            <span className="board-who">
              <span className="board-name">{player(e.playerId)}</span>
              <span className="board-sub">
                {e.slot} · {team(e.rosterId)} · W{e.week}
              </span>
            </span>
            <span className="board-num font-bold">{pts(e.points)}</span>
          </li>
        ))}
      />
      <ShameCard
        title="Lazy Manager"
        empty="Every slot filled. Nobody forgot to set a lineup. Yet."
        board={{ labels: ["Team", "Empty"], cols: "minmax(0, 1fr) 3.5rem" }}
        items={stats.lazyManager.map((t) => (
          <li key={t.rosterId} className="board-row">
            {name(team(t.rosterId))}
            {num(t.count, t.count === 1 ? "empty slot" : "empty slots")}
          </li>
        ))}
      />
      <ShameCard
        title="Ice Streaks"
        empty="No streaks. Everyone keeps sobering up between weeks."
        board={{ labels: ["Team", "Longest", "Now"], cols: "minmax(0, 1fr) 4rem 2.5rem" }}
        items={stats.streaks
          .filter((s) => s.longest > 0)
          .slice(0, 5)
          .map((s) => (
            <li key={s.rosterId} className="board-row">
              {name(team(s.rosterId))}
              {num(s.longest, s.longest === 1 ? "week longest" : "weeks longest")}
              {num(s.current, "now")}
            </li>
          ))}
      />
      <ShameCard
        title="Lowest-Score Magnets"
        empty="Nobody has finished dead last yet."
        board={{ labels: ["Team", "Times"], cols: "minmax(0, 1fr) 3rem" }}
        items={stats.lowestMagnets.map((t) => (
          <li key={t.rosterId} className="board-row">
            {name(team(t.rosterId))}
            {num(t.count, t.count === 1 ? "time lowest" : "times lowest")}
          </li>
        ))}
      />
    </div>
  );
}
