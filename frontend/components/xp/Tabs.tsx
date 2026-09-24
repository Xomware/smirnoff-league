"use client";

import { type KeyboardEvent, type ReactNode, useContext, useEffect, useId, useRef, useState } from "react";

import { ViewParamsContext } from "@/components/views/drill-link";

export interface Tab {
  id: string;
  label: string;
  panel: () => ReactNode;
}

interface TabsProps {
  label: string;
  tabs: Tab[];
  // The view's `tab` param, which a link can name.
  selected?: string | number;
}

// An XP property-sheet tab strip, keyed the WAI-ARIA tabs way: arrows move and
// select, Home/End jump, and only the selected tab is in the tab order.
export function Tabs({ label, tabs, selected: param }: TabsProps) {
  // Outside a window or page, the strip keeps its own state.
  const setParams = useContext(ViewParamsContext);
  const [own, setOwn] = useState(param);
  const current = setParams ? param : own;
  const selected = Math.max(0, tabs.findIndex((t) => t.id === current));
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ start: false, end: false });

  // A phone's strip scrolls sideways, fading at an edge while there is more that way.
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    setMore({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  };

  useEffect(() => {
    const el = strip.current;
    const tab = refs.current[selected];
    if (el && tab) el.scrollLeft += tab.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - tab.offsetWidth) / 2;
    measure();
  }, [selected]);

  const pick = (i: number) => (setParams ? setParams({ tab: tabs[i].id }) : setOwn(tabs[i].id));
  const select = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    pick(next);
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
      <div
        ref={strip}
        role="tablist"
        aria-label={label}
        className="xp-tab-strip"
        data-more-start={more.start || undefined}
        data-more-end={more.end || undefined}
        onKeyDown={onKeyDown}
        onScroll={measure}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
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
            onClick={() => pick(i)}
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
