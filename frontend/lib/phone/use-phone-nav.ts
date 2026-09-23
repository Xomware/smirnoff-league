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

// Browser history mirrors the current tab's stack, one entry per screen, so
// the browser's Back, Android's back button and iOS's edge swipe all pop a
// screen. The shell's own Back goes through history.back() for the same reason.
export function usePhoneNav() {
  const [nav, dispatch] = useReducer(navReducer, undefined, initialNav);
  const [synced, resync] = useReducer((n: number) => n + 1, 0);
  // Index of the current entry among ours, and the tab whose stack entries 0..at hold.
  const at = useRef(0);
  const owner = useRef<Tab | null>(null);
  const rewinding = useRef(false);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const entry = entryOf(e.state);
      if (rewinding.current) {
        rewinding.current = false;
        at.current = entry ? entry.stack.length - 1 : 0;
        resync();
        return;
      }
      if (!entry) return;
      at.current = entry.stack.length - 1;
      dispatch({ type: "set", ...entry });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (rewinding.current) return;
    const { tab } = nav;
    const stack = stackOf(nav);
    // Entries under the top must all be this tab's, or its Back would land on
    // another tab. A tab switch or a reset first rewinds history to where the
    // two stacks agree; history.go is async, so the rebuild waits for popstate.
    const keep = owner.current === tab ? Math.min(at.current, stack.length - 1) : 0;
    if (keep < at.current) {
      rewinding.current = true;
      window.history.go(keep - at.current);
      return;
    }
    const write = (i: number) => [{ phone: { tab, stack: stack.slice(0, i + 1) } }, "", stackUrl(stack.slice(0, i + 1))] as const;
    window.history.replaceState(...write(keep));
    for (let i = keep + 1; i < stack.length; i++) window.history.pushState(...write(i));
    at.current = stack.length - 1;
    owner.current = tab;
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
    back: () => window.history.back(),
  };
}
