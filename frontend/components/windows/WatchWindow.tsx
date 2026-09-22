"use client";

import { useEffect, useMemo, useRef } from "react";

import { DrillLink } from "@/components/views/drill-link";
import { PlayerRow } from "@/components/xp/PlayerRow";
import { TeamName } from "@/components/xp/TeamName";
import { type Notice, useAlerts } from "@/lib/alerts/alerts";
import type { Game } from "@/lib/espn";
import { POLL_MS, useIceWatch } from "@/lib/ices/use-ice-watch";
import { type StarterWatch, type TeamWatch, type WatchState, watchStates } from "@/lib/ices/watch";
import { type Player, useLeague } from "@/lib/league/use-league";

const RANK: Partial<Record<WatchState, number>> = { FINAL_ICE: 0, WATCH: 1, LOCKED: 2 };
const TAG: Partial<Record<WatchState, string>> = { FINAL_ICE: "ICED", WATCH: "WATCH", LOCKED: "LOCKED" };

function chip(s: StarterWatch, player: Player | undefined): string {
  const g = s.game;
  if (!s.playerId) return "EMPTY";
  if (!g) return "BYE";
  if (g.completed) return "FINAL";
  if (g.state === "pre") {
    if (s.state === "LOCKED") return (player?.injury_status ?? "OUT").toUpperCase();
    return new Date(g.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  if (g.status === "STATUS_HALFTIME") return "HALF";
  const q = g.period > 4 ? "OT" : `Q${g.period}`;
  return g.status === "STATUS_END_PERIOD" ? `END ${q}` : `${q} ${g.clock}`;
}

function when(g: Game): string {
  if (g.status === "STATUS_HALFTIME") return "at halftime";
  if (g.period > 4) return "in OT";
  return `in the ${["1st", "2nd", "3rd", "4th"][g.period - 1]}`;
}

const danger = (t: TeamWatch) => [t.finalIce, t.watch, t.locked];

function byDanger(a: TeamWatch, b: TeamWatch): number {
  const [da, db] = [danger(a), danger(b)];
  const i = da.findIndex((n, k) => n !== db[k]);
  return i === -1 ? a.rosterId - b.rosterId : db[i] - da[i];
}

export function WatchWindow() {
  const { data, error: leagueError, teamFor } = useLeague();
  const week = data ? Math.max(1, data.nfl.week) : undefined;
  const { matchups, games, error: watchError } = useIceWatch(week);
  const { notify } = useAlerts();
  const seen = useRef<Map<string, WatchState> | null>(null);
  const error = leagueError ?? watchError;

  const teams = useMemo(
    () => (data && week && matchups && games ? watchStates(week, matchups, games, data.players).sort(byDanger) : null),
    [data, week, matchups, games],
  );

  useEffect(() => {
    if (!teams || !data) return;
    // On first load only live danger is news; ices that already went final are not.
    const first = seen.current === null;
    const prev = seen.current ?? new Map<string, WatchState>();
    const fresh = teams.flatMap((t) =>
      t.starters
        .filter((s) => s.state !== prev.get(s.id) && (s.state === "WATCH" || (!first && s.state === "FINAL_ICE")))
        .map((s) => ({ ...s, team: teamFor(t.rosterId).name })),
    );
    seen.current = new Map(teams.flatMap((t) => t.starters.map((s) => [s.id, s.state])));
    if (fresh.length === 0) return;

    const [s] = fresh;
    const name = data.players[s.playerId!]?.name ?? s.playerId;
    const notice: Notice =
      fresh.length > 1
        ? { title: "ICE WATCH", body: `${fresh.length} starters just landed on the Ice Watch.`, icon: "warning" }
        : s.state === "WATCH"
          ? { title: "ICE WATCH", body: `${s.team}: ${name} has ${s.points.toFixed(1)} pts ${when(s.game!)}.`, icon: "warning" }
          : { title: "ICED", body: `${s.team}: ${name} finished with ${s.points.toFixed(1)} pts. That's an ice.` };
    notify(notice);
  }, [teams, data, teamFor, notify]);

  if (!data || !teams || !games) {
    if (error) return <p role="alert">Could not load the Ice Watch ({error}). Reopen the window to try again.</p>;
    return <p role="status">Checking the scoreboard...</p>;
  }

  const liveGames = games.filter((g) => g.state === "in").length;

  return (
    <div className="xp-inset grid h-full content-start gap-3 overflow-auto p-2">
      <p aria-live="polite" className="text-xs">
        Week {week}:{" "}
        {liveGames > 0
          ? `${liveGames} ${liveGames === 1 ? "game" : "games"} live. Checking every ${POLL_MS / 1000} seconds.`
          : "no games in progress."}
      </p>
      {error && <p role="alert" className="xp-note">The last check failed ({error}). Retrying.</p>}
      {teams.length === 0 && <p className="xp-note">Sleeper has no lineups for week {week} yet.</p>}
      {teams.map((t) => {
        const { name } = teamFor(t.rosterId);
        const flagged = t.starters.filter((s) => RANK[s.state] !== undefined).sort((a, b) => RANK[a.state]! - RANK[b.state]!);
        return (
          <section key={t.rosterId} aria-label={`${name} ice watch`}>
            <DrillLink to={{ kind: "team", rosterId: t.rosterId }}>
              <TeamName name={name} iced={t.finalIce + t.locked > 0} ices={t.finalIce + t.locked} />
            </DrillLink>
            {flagged.length === 0 ? (
              <p className="mt-1 text-xs italic">All starters safe.</p>
            ) : (
              <ul aria-label={`${name} starters on watch`} className="mt-1 bg-(--xp-cream)">
                {flagged.map((s) => {
                  const player = s.playerId ? data.players[s.playerId] : undefined;
                  return (
                    <PlayerRow
                      key={s.id}
                      name={s.playerId ? <DrillLink to={{ kind: "player", playerId: s.playerId }}>{player?.name ?? s.playerId}</DrillLink> : "Empty slot"}
                      position={s.slot}
                      points={s.points}
                      iced={s.state !== "WATCH"}
                      watch={s.state === "WATCH"}
                      ices={0}
                      status={
                        <>
                          <span className="xp-watch-tag">{TAG[s.state]}</span>
                          <span className="xp-game-chip">{chip(s, player)}</span>
                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
