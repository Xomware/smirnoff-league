"use client";

import { useId, useState } from "react";

import { TeamName } from "@/components/xp/TeamName";
import { type Award, awardLine, AWARDS, awardLabel, awardStat, type Names, type Tally } from "@/lib/awards/awards";
import { useAwards } from "@/lib/awards/use-awards";
import type { WindowParams } from "@/lib/desktop/windows";
import type { Team } from "@/lib/league/use-league";
import { AWARD_ICONS } from "./award-icons";
import { DrillLink } from "./drill-link";

import "./awards.css";

interface AwardCardProps {
  id: Award["id"];
  award: Award | undefined;
  names: Names;
  teamFor: (rosterId: number) => Team;
}

function AwardCard({ id, award, names, teamFor }: AwardCardProps) {
  const Icon = AWARD_ICONS[id];
  const lines = award?.winners.map((w) => awardLine(award, w, names)) ?? [];
  // Co-winners of a top score or Ice King share one line; a blowout tie names each opponent.
  const shared = lines.every((l) => l === lines[0]);
  return (
    <li className="xp-dialog award-card">
      <h3 className="xp-dialog-title">{awardLabel(id)}</h3>
      <div className="award-body">
        <Icon width={40} height={40} className="award-icon" />
        {award ? (
          <div className="award-text">
            <strong className="award-stat">{awardStat(award)}</strong>
            {award.winners.map((w, i) => (
              <div key={`${w.rosterId}:${w.playerId ?? w.chugger ?? ""}`} className="award-winner">
                <DrillLink to={{ kind: "team", rosterId: w.rosterId }}>
                  <TeamName name={teamFor(w.rosterId).name} avatarUrl={teamFor(w.rosterId).avatarUrl} iced={false} ices={0} />
                </DrillLink>
                {!shared && <p className="award-line">{lines[i]}</p>}
              </div>
            ))}
            {shared && <p className="award-line">{lines[0]}</p>}
          </div>
        ) : (
          <p className="award-line award-none">No winner this week.</p>
        )}
      </div>
    </li>
  );
}

function SeasonTally({ tally, teamFor }: { tally: Tally; teamFor: (rosterId: number) => Team }) {
  const title = useId();
  const top = tally.teams.filter((t) => t.count === tally.teams[0]?.count);
  const team = (rosterId: number) => (
    <DrillLink key={rosterId} to={{ kind: "team", rosterId }}>
      {teamFor(rosterId).name}
    </DrillLink>
  );
  return (
    <section className="xp-group awards-tally" aria-labelledby={title}>
      <h3 id={title} className="xp-group-title">
        Season tally
      </h3>
      {top.length > 0 && (
        <p className="awards-hardware">
          Most hardware: {top.map((t, i) => [i > 0 && " and ", team(t.rosterId)])} with {top[0].count}{" "}
          {top[0].count === 1 ? "award" : "awards"}.
        </p>
      )}
      <ul className="awards-leaders" aria-label="Most wins by award">
        {tally.byAward.map(({ id, count, leaders }) => {
          const Icon = AWARD_ICONS[id];
          return (
            <li key={id}>
              <Icon width={20} height={20} />
              <span className="awards-leader-name">{awardLabel(id)}</span>
              <span className="awards-leader-who">
                {leaders.length === 0 ? "Not won yet" : leaders.map((r, i) => [i > 0 && ", ", team(r)])}
              </span>
              {count > 0 && (
                <span className="awards-leader-count">
                  {count} {count === 1 ? "win" : "wins"}
                  {leaders.length > 1 && " each"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AwardsView({ params }: { params: WindowParams }) {
  const { weeks, tally, players, teamFor, error, ledgerError } = useAwards();
  const [picked, setPicked] = useState<number | null>(null);

  if (error) return <p role="alert">Could not load the awards ({error}). Refresh to try again.</p>;
  if (!weeks || !tally) return <p role="status">Polishing the trophies...</p>;

  const wanted = picked ?? (params.week === undefined ? null : Number(params.week));
  const shown = weeks.find((w) => w.week === wanted) ?? weeks.at(-1);
  const names: Names = { team: (id) => teamFor(id).name, player: (id) => players[id]?.name ?? `Player ${id}` };

  return (
    <div className="awards">
      <header>
        <h2 className="rank-title">Weekly Awards</h2>
        <p>Handed out once a week is final.</p>
      </header>
      {!shown ? (
        <p className="xp-inset p-3">No week is final yet. The first awards go out once Week 1 is locked in.</p>
      ) : (
        <>
          <div className="rank-chips" role="group" aria-label="Week">
            {weeks.map(({ week }) => (
              <button key={week} type="button" className="rank-chip" aria-pressed={week === shown.week} onClick={() => setPicked(week)}>
                Week {week}
              </button>
            ))}
          </div>
          {ledgerError && <p className="xp-note">Ice King and Fastest Chug need the ledger, which is unavailable ({ledgerError}).</p>}
          <ul className="awards-grid" aria-label={`Week ${shown.week} awards`}>
            {AWARDS.map(({ id }) => (
              <AwardCard key={id} id={id} award={shown.awards.find((a) => a.id === id)} names={names} teamFor={teamFor} />
            ))}
          </ul>
          <SeasonTally tally={tally} teamFor={teamFor} />
        </>
      )}
    </div>
  );
}
