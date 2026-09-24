import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Tab } from "./nav";

// Returns the old mode, to put back.
function restoreScroll(mode: ScrollRestoration) {
  const was = window.history.scrollRestoration;
  window.history.scrollRestoration = mode;
  return was;
}

/**
 * The phone page is the document. Back lands on a screen that stayed mounted,
 * so it returns to where that screen was left; a new screen or section starts
 * at the top. Returns whether the page has scrolled off the top.
 */
export function usePageScroll(key: string, tab: Tab, depth: number): boolean {
  const [scrolled, setScrolled] = useState(false);
  const at = useRef({ key, tab, depth });
  const positions = useRef(new Map<string, number>());

  // The browser would otherwise restore its own guess on Back.
  useEffect(() => {
    const was = restoreScroll("manual");
    const onScroll = () => {
      positions.current.set(at.current.key, window.scrollY);
      // Shrinking the bar shortens the page, which can pull a short page back
      // under 24px and grow it again; the gap stops that flicker.
      setScrolled((on) => window.scrollY > (on ? 4 : 24));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      restoreScroll(was);
    };
  }, []);

  // Before paint, or the old offset flashes on the new screen.
  useLayoutEffect(() => {
    const from = at.current;
    if (from.key === key) return;
    at.current = { key, tab, depth };
    const returning = tab === from.tab && depth < from.depth;
    window.scrollTo(0, returning ? (positions.current.get(key) ?? 0) : 0);
  }, [key, tab, depth]);

  return scrolled;
}
