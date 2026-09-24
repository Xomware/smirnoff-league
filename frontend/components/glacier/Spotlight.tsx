"use client";

import { type FocusEvent, useContext, useEffect, useState } from "react";

import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { REGISTRY } from "@/lib/desktop/registry";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Panel } from "./HomePanel";

export interface Fact {
  id: string;
  label: string;
  value: string;
  sub: string;
  to: DrillTarget;
}

const ROTATE_MS = 5000;

const Chevron = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={className}>
    <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Facts open a fixed page or a week, and neither title needs the league.
function pageName(to: DrillTarget): string {
  if (to.kind === "week") return `Week ${to.week}`;
  const { title } = REGISTRY[to.kind];
  return typeof title === "string" ? title : to.kind;
}

// The whole card is the link; the carousel's arrows and dots sit outside it.
function FactCard({ fact }: { fact: Fact }) {
  const open = useContext(DrillContext);
  return (
    <button
      type="button"
      className="gh-fact gh-fact-open"
      aria-label={`${fact.label}: ${fact.value}, open ${pageName(fact.to)}`}
      onClick={() => open(fact.to)}
    >
      <span className="gh-fact-label">{fact.label}</span>
      <span className="gh-fact-value">{fact.value}</span>
      <span className="gh-fact-sub">{fact.sub}</span>
      <Chevron className="gh-fact-go" />
    </button>
  );
}

interface SpotlightProps {
  id: string;
  label: string;
  // Null while the data behind the facts is loading.
  facts: Fact[] | null;
}

export function Spotlight({ id, label, facts }: SpotlightProps) {
  const still = useReducedMotion();
  const [picked, setAt] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const count = facts?.length ?? 0;
  const at = count ? picked % count : 0;
  const held = hovered || focused;

  // Keyed on `at` too, so a manual step gets a full 5 seconds before the next one.
  useEffect(() => {
    if (still || held || count < 2) return;
    const timer = setInterval(() => setAt((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [still, held, count, at]);

  const step = (by: number) => setAt((at + by + count) % count);
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  const body = () => {
    if (!facts) return <p role="status">Crunching the numbers...</p>;
    if (!count) return <p className="gh-quiet">Nothing to report yet.</p>;
    if (still) {
      return (
        <ul aria-label={label} className="gh-facts">
          {facts.map((f) => (
            <li key={f.id}>
              <FactCard fact={f} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <>
        <div className="gh-slides" aria-live={held ? "polite" : "off"}>
          {facts.map((f, i) => (
            <div
              key={f.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${f.label}, ${i + 1} of ${count}`}
              className="gh-slide"
              data-on={i === at || undefined}
              aria-hidden={i !== at || undefined}
              inert={i !== at}
            >
              <FactCard fact={f} />
            </div>
          ))}
        </div>
        {count > 1 && (
          <div className="gh-dots">
            {facts.map((f, i) => (
              <button
                key={f.id}
                type="button"
                aria-label={`Show ${f.label}`}
                aria-current={i === at || undefined}
                onClick={() => setAt(i)}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  const arrows = !still && count > 1 && (
    <span className="gh-arrows">
      <button type="button" className="gh-arrow" aria-label="Previous fact" onClick={() => step(-1)}>
        <Chevron />
      </button>
      <button type="button" className="gh-arrow" aria-label="Next fact" onClick={() => step(1)}>
        <Chevron />
      </button>
    </span>
  );

  return (
    <Panel
      id={id}
      label={label}
      className="gh-spot"
      aside={arrows}
      aria-roledescription={still ? undefined : "carousel"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      {body()}
    </Panel>
  );
}
