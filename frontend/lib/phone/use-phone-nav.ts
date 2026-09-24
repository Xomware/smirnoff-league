"use client";

import { useEffect, useReducer, useRef } from "react";

import { track } from "@/lib/activity/tracker";
import { type Nav, navFromLinks, navReducer, parseScreens, type Screen, screenId, stackOf, stackUrl, type Tab } from "./nav";

interface Entry {
  tab: Tab;
  stack: Screen[];
}

const entryOf = (state: unknown): Entry | null => (state as { phone?: Entry } | null)?.phone ?? null;

const initialNav = (): Nav => navFromLinks(parseScreens(window.location.search));

const agreed = (a: Screen[], b: Screen[]) => {
  let n = 0;
  while (n < a.length && n < b.length && screenId(a[n]) === screenId(b[n])) n++;
  return n;
};

// Browser history mirrors the current tab's stack, one entry per screen, so
// the browser's Back, Android's back button and iOS's edge swipe all pop a
// screen. The shell's own Back goes through history.back() for the same reason.
export function usePhoneNav() {
  const [nav, dispatch] = useReducer(navReducer, undefined, initialNav);
  const [synced, resync] = useReducer((n: number) => n + 1, 0);
  // Index of the current entry among ours, the tab whose stack entries 0..at
  // hold, and that stack.
  const at = useRef(0);
  const owner = useRef<Tab | null>(null);
  const written = useRef<Screen[]>([]);
  const rewinding = useRef(false);
  const opening = useRef(false);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const entry = entryOf(e.state);
      if (entry) {
        at.current = entry.stack.length - 1;
        owner.current = entry.tab;
        written.current = entry.stack;
      }
      if (rewinding.current) {
        rewinding.current = false;
        if (!entry) at.current = 0;
        resync();
        return;
      }
      if (entry) dispatch({ type: "set", ...entry });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (rewinding.current) return;
    const { tab } = nav;
    const stack = stackOf(nav);
    const opened = opening.current;
    opening.current = false;
    const same = owner.current === tab ? agreed(written.current, stack) : 0;
    const write = (i: number) => [{ phone: { tab, stack: stack.slice(0, i + 1) } }, "", stackUrl(stack.slice(0, i + 1))] as const;
    // A page opened from a sub-tab, the drawer or a link goes on top, like a
    // desktop page, so Back returns to wherever it was opened from.
    if (opened && same === 0) {
      for (let i = 0; i < stack.length; i++) window.history.pushState(...write(i));
    } else {
      // Entries under the top must all be this tab's, or its Back would land on
      // another tab. A tab switch or a reset first rewinds history to where the
      // two stacks agree; history.go is async, so the rebuild waits for popstate.
      const keep = Math.max(same - 1, 0);
      if (keep < at.current) {
        rewinding.current = true;
        window.history.go(keep - at.current);
        return;
      }
      window.history.replaceState(...write(keep));
      for (let i = keep + 1; i < stack.length; i++) window.history.pushState(...write(i));
    }
    at.current = stack.length - 1;
    owner.current = tab;
    written.current = stack;
  }, [nav, synced]);

  return {
    nav,
    push: (screen: Screen) => {
      dispatch({ type: "push", screen });
      track("open", screenId(screen));
    },
    // A tab is how a phone gets to most screens, so it counts as an open.
    selectTab: (tab: Tab) => {
      dispatch({ type: "tab", tab });
      track("open", `tab:${tab}`);
    },
    open: (tab: Tab, screen: Screen) => {
      opening.current = true;
      dispatch({ type: "open", tab, screen });
      track("open", screenId(screen));
    },
    back: () => window.history.back(),
  };
}
