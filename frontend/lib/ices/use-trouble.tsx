"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { liveLowest, type Trouble, troubleByRoster } from "./trouble";
import { useIceWatch } from "./use-ice-watch";
import { useLedger } from "./use-ledger";
import { type StarterWatch, watchStates } from "./watch";

interface TroubleState {
  of: (rosterId: number) => Trouble[];
  // TeamName only gets a name, and its thirty call sites don't pass the roster.
  byName: (name: string) => Trouble[];
  /** Your starters on the Ice Watch, already iced, or still fixable (OPEN) this live week. */
  myZeros: StarterWatch[];
}

const NONE: Trouble[] = [];
const OFF: TroubleState = { of: () => NONE, byName: () => NONE, myZeros: [] };

// XP styles none of this, so outside Glacier the provider stays off and polls nothing.
const TroubleContext = createContext<TroubleState>(OFF);

export function TroubleProvider({ on, children }: { on: boolean; children: ReactNode }) {
  const ledger = useLedger();
  const { data, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const week = on && data ? Math.max(1, data.nfl.week) : undefined;
  const { matchups, games } = useIceWatch(week);

  const value = useMemo((): TroubleState => {
    if (!data || week === undefined) return OFF;
    const live = matchups && games;
    const map = troubleByRoster(ledger.status === "ok" ? ledger.ledger.summary : [], live ? liveLowest(week, matchups, games) : []);
    const names = new Map([...map].map(([id, t]) => [teamFor(id).name, t]));
    const mine = live ? watchStates(week, matchups.filter((m) => m.roster_id === myRosterId), games, data.players) : [];
    return {
      of: (id) => map.get(id) ?? NONE,
      byName: (name) => names.get(name) ?? NONE,
      myZeros: mine.flatMap((t) => t.starters.filter((s) => s.state === "WATCH" || s.state === "FINAL_ICE" || s.state === "OPEN")),
    };
  }, [data, week, matchups, games, ledger, teamFor, myRosterId]);

  return <TroubleContext value={value}>{children}</TroubleContext>;
}

export const useTrouble = () => useContext(TroubleContext);
