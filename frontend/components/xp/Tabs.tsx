"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

export interface Tab {
  label: string;
  panel: () => ReactNode;
}

interface TabsProps {
  label: string;
  tabs: Tab[];
}

// An XP property-sheet tab strip, keyed the WAI-ARIA tabs way: arrows move and
// select, Home/End jump, and only the selected tab is in the tab order.
export function Tabs({ label, tabs }: TabsProps) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    setSelected(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    select(moves[e.key]);
  };

  return (
    <div className="xp-tabs">
      <div role="tablist" aria-label={label} className="xp-tab-strip" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === selected}
            aria-controls={`${id}-panel`}
            tabIndex={i === selected ? 0 : -1}
            className="xp-tab"
            onClick={() => setSelected(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0} className="xp-tab-panel">
        {tabs[selected].panel()}
      </div>
    </div>
  );
}
