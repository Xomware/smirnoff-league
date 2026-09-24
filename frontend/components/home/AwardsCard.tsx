"use client";

import { useContext, useId } from "react";

import { AWARD_ICONS } from "@/components/views/award-icons";
import { DrillContext } from "@/components/views/drill-link";
import { awardLabel, awardStat } from "@/lib/awards/awards";
import { useAwards } from "@/lib/awards/use-awards";

import "@/components/views/awards.css";

const SHOWN = 3;

interface AwardsCardProps {
  className: string;
  titleClass: string;
  Heading?: "h2" | "h3";
}

// The latest final week's first three awards. Nothing shows until a week has
// awards, so Home doesn't hold a slot open for them.
export function AwardsCard({ className, titleClass, Heading = "h3" }: AwardsCardProps) {
  const { weeks, teamFor } = useAwards();
  const open = useContext(DrillContext);
  const title = useId();
  const latest = weeks?.at(-1);
  if (!latest || latest.awards.length === 0) return null;

  return (
    <section aria-labelledby={title} className={`awards-brief ${className}`}>
      <Heading id={title} className={titleClass}>
        Week {latest.week} awards
      </Heading>
      <ul className="awards-brief-list">
        {latest.awards.slice(0, SHOWN).map((award) => {
          const Icon = AWARD_ICONS[award.id];
          const who = award.winners.map((w) => teamFor(w.rosterId).name).join(", ");
          return (
            <li key={award.id}>
              <button
                type="button"
                className="awards-brief-open"
                aria-label={`${awardLabel(award.id)}: ${who}, open Week ${latest.week} awards`}
                onClick={() => open({ kind: "awards", week: latest.week })}
              >
                <Icon width={24} height={24} />
                <span className="awards-brief-label">{awardLabel(award.id)}</span>
                <span className="awards-brief-who">{who}</span>
                <span className="awards-brief-stat">{awardStat(award)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
