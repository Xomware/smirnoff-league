"use client";

import type { MouseEvent } from "react";

import { chugTime } from "@/components/videos/ChugTime";
import { MediaPlayerIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import type { Ledger, LedgerIce } from "@/lib/api/ledger";
import type { Video } from "@/lib/api/videos";
import { deadlineOf } from "@/lib/ices/ledger-stats";
import { clock, etDeadline, lateNow } from "@/lib/ices/ledger-weeks";
import type { Player, Team } from "@/lib/league/use-league";
import { cause } from "@/lib/ticker/items";
import { videoFor } from "@/lib/videos/use-videos";
import { DrillLink } from "./drill-link";

export function oweCause(ice: LedgerIce, ledger: Ledger, players: Record<string, Player>): string {
  if (ice.reason !== "late") return cause(ice, players);
  const parent = ledger.ices.find((i) => i.iceId === ice.parentIceId);
  return `late ice ${ice.iceId.split("#LATE")[1] ?? ""}${parent ? ` · ${cause(parent, players)}` : ""}`;
}

interface PlayButtonProps {
  label: string;
  onPlay: () => void;
}

export function PlayButton({ label, onPlay }: PlayButtonProps) {
  // Safari never focuses a clicked button, and the player hands focus back to whatever had it.
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus();
    onPlay();
  };
  return (
    <button type="button" className="xp-button chug-row-button owe-play" aria-label={`Play ${label} chug`} onClick={onClick}>
      <MediaPlayerIcon width={16} height={16} aria-hidden />
      Play
    </button>
  );
}

interface OweRowsProps {
  label: string;
  ledger: Ledger;
  ices: LedgerIce[];
  now: number;
  players: Record<string, Player>;
  teamFor: (rosterId: number) => Team;
  videos: Video[];
  onPlay: (video: Video, label: string) => void;
}

// One line per ice: who, then its clock or its chug; what and when underneath.
export function OweRows({ label, ledger, ices, now, players, teamFor, videos, onPlay }: OweRowsProps) {
  return (
    <ul aria-label={label} className="owe-rows">
      {ices.map((ice) => {
        const name = teamFor(ice.rosterId).name;
        const paid = ice.status === "completed";
        const deadline = deadlineOf(ledger, ice.week);
        // A late row can predate its week's deadline when an admin backdates one.
        const due = lateNow(ledger, ice, now) && (deadline === null || deadline > now) ? { level: "late", text: "LATE" } : clock(deadline, now);
        const video = paid ? videoFor(videos, ice) : undefined;
        return (
          <li key={ice.iceId} className="owe-row" data-level={paid ? "paid" : due.level}>
            <DrillLink to={{ kind: "team", rosterId: ice.rosterId, tab: "ices" }}>
              <TeamName name={name} iced={!paid} ices={0} badges={false} />
            </DrillLink>
            {paid ? (
              <span className="owe-paid">
                <span className="xp-watch-tag">{ice.chugSeconds === undefined ? "Paid" : chugTime(ice.chugSeconds)}</span>
                {video && <PlayButton label={`${name} week ${ice.week}`} onPlay={() => onPlay(video, `${name} · Week ${ice.week}`)} />}
              </span>
            ) : (
              <span className="xp-watch-tag who-owes-due" data-level={due.level}>
                {due.text}
              </span>
            )}
            <span className="owe-why">
              W{ice.week} · {oweCause(ice, ledger, players)}
              {!paid && deadline !== null && ` · due ${etDeadline(deadline)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
