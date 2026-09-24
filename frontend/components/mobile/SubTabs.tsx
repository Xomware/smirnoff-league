"use client";

import { useEffect, useRef, useState } from "react";

import type { PageKind, SubPage } from "@/lib/sections";

interface SubTabsProps {
  label: string;
  pages: SubPage[];
  current: PageKind;
  onPick: (page: SubPage) => void;
}

// A section's pages, as the desktop sub-nav lists them. The row scrolls
// sideways when it overflows, and fades at an edge while there is more that way.
export function SubTabs({ label, pages, current, onPick }: SubTabsProps) {
  const row = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ start: false, end: false });

  const measure = () => {
    const el = row.current;
    if (!el) return;
    setMore({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  };

  useEffect(() => {
    const el = row.current;
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && tab) el.scrollLeft = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2;
    measure();
  }, [current]);

  return (
    <nav
      ref={row}
      aria-label={label}
      className="m-subtabs"
      data-more-start={more.start || undefined}
      data-more-end={more.end || undefined}
      onScroll={measure}
    >
      {pages.map((page) => (
        <button
          key={page.kind}
          type="button"
          className="m-subtab"
          aria-current={page.kind === current ? "page" : undefined}
          onClick={() => onPick(page)}
        >
          {page.label}
        </button>
      ))}
    </nav>
  );
}
