"use client";

import { useEffect, useRef } from "react";

import { useAlerts } from "@/lib/alerts/alerts";
import type { Ice } from "@/lib/ices/compute";
import { useSeasonIces } from "@/lib/ices/use-season-ices";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { playWhenAllowed } from "@/lib/sound/sound";

// Runs once per signed-in load: the startup chime, the ice report balloon, and
// an ICE.EXE crash if your own starter laid an egg in the reported week.
export function SignInGreeting() {
  const { notify, alert } = useAlerts();
  const { myRosterId } = useProfile();
  const { data, teamFor } = useLeague();
  const { tally } = useSeasonIces(data ? Math.max(1, data.nfl.week) : undefined);
  const shown = useDefaultWeek(data?.nfl);
  const reported = useRef(false);

  useEffect(() => {
    playWhenAllowed("startup");
  }, []);

  useEffect(() => {
    if (!tally || !data || shown === undefined || reported.current) return;
    reported.current = true;

    // The live week once it has kicked off and has ices, otherwise the last finished week.
    const live = tally.live?.week === shown && tally.live.ices.length ? tally.live : null;
    const last = tally.weeks.at(-1);
    const week = live ?? last;
    const ices: Ice[] = week?.ices ?? [];
    const rosters = [...new Set(ices.map((i) => i.rosterId))];
    if (!week || rosters.length === 0) {
      notify({ title: "Ice report", body: "Nobody is iced yet. Suspicious. The league is watching.", icon: "info" });
      return;
    }

    const when = live ? "this week" : `in week ${week.week}`;
    const names = rosters.map((id) => teamFor(id).name).join(", ");
    const mine = myRosterId !== null && rosters.includes(myRosterId);
    notify({
      title: mine ? "You've got ice!" : "Ice report",
      body: `${rosters.length} ${rosters.length === 1 ? "team" : "teams"} iced ${when}: ${names}.`,
    });

    const zeros = ices.filter((i) => i.rosterId === myRosterId && i.reason === "zero");
    if (zeros.length === 0) return;
    const culprits = zeros
      .map((i) => `${data.players[i.playerId ?? ""]?.name ?? `your ${i.slot}`} (${i.points.toFixed(1)} pts)`)
      .join(", ");
    void alert({
      kind: "error",
      title: "ICE.EXE",
      body:
        `ICE.EXE has encountered a problem and needs to close. Faulting module: ${culprits}, week ${week.week}. ` +
        "We are sorry for the inconvenience. Please chug to continue.",
      buttons: ["Send Error Report", "Don't Send"],
    });
  }, [tally, data, shown, teamFor, myRosterId, notify, alert]);

  return null;
}
