import { Fragment, type ReactNode, useId } from "react";

import type { iceStats } from "@/lib/ices/stats";
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
}

const pts = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ShameCard({ title, empty, items, className = "" }: ShameCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`xp-dialog ${className}`}>
      <h3 id={id} className="xp-dialog-title">{title}</h3>
      {items.length === 0 ? (
        <p className="p-3">{empty}</p>
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
  const pair = `${row} flex-row justify-between gap-2 [&>:last-child]:shrink-0 [&>:last-child]:text-right`;

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
        items={stats.closestEscapes.slice(0, 10).map((e) => (
          <li key={`${e.week}-${e.rosterId}-${e.slotIndex}`} className={pair}>
            <span>
              {player(e.playerId)} ({e.slot}), {team(e.rosterId)}, W{e.week}
            </span>
            <span className="font-bold tabular-nums">{pts(e.points)}</span>
          </li>
        ))}
      />
      <ShameCard
        title="Lazy Manager"
        empty="Every slot filled. Nobody forgot to set a lineup. Yet."
        items={stats.lazyManager.map((t) => (
          <li key={t.rosterId} className={pair}>
            <span>{team(t.rosterId)}</span>
            <span className="font-bold">{plural(t.count, "empty slot")}</span>
          </li>
        ))}
      />
      <ShameCard
        title="Ice Streaks"
        empty="No streaks. Everyone keeps sobering up between weeks."
        items={stats.streaks
          .filter((s) => s.longest > 0)
          .slice(0, 5)
          .map((s) => (
            <li key={s.rosterId} className={pair}>
              <span>{team(s.rosterId)}</span>
              <span>
                <span className="font-bold">longest {plural(s.longest, "week")}</span>, current {s.current}
              </span>
            </li>
          ))}
      />
      <ShameCard
        title="Lowest-Score Magnets"
        empty="Nobody has finished dead last yet."
        items={stats.lowestMagnets.map((t) => (
          <li key={t.rosterId} className={pair}>
            <span>{team(t.rosterId)}</span>
            <span className="font-bold">{plural(t.count, "time")} lowest</span>
          </li>
        ))}
      />
    </div>
  );
}
