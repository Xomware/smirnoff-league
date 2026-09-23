"use client";

import { useEffect, useState } from "react";

import { IceBadge } from "@/components/xp/IceBadge";
import { IceBottleIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";
import { loadOverview, type Overview } from "@/lib/league/overview";

type State = { status: "loading" } | { status: "ok"; overview: Overview } | { status: "error" };

const POLL = 60_000;

// Public Sleeper and ESPN data only. Any failure hides the whole section: the
// landing exists to get people signed in, and a broken widget shouldn't say otherwise.
export function LeagueStatus() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    const load = () =>
      loadOverview().then(
        (overview) => mounted && setState({ status: "ok", overview }),
        () => mounted && setState({ status: "error" }),
      );
    load();
    const timer = setInterval(load, POLL);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (state.status === "error") return null;

  return (
    <div className="flex justify-center px-4 pt-16 sm:px-8">
      <Window title="League Status" icon={<IceBottleIcon width={16} height={16} />} controls className="max-w-lg">
        <div className="landing-tabs" aria-hidden>
          <span>General</span>
        </div>
        <div className="xp-inset flex gap-4 p-3 text-sm">
          <span className="hidden shrink-0 sm:block">
            <IceBottleIcon width={56} height={56} />
          </span>
          {state.status === "ok" ? <Details overview={state.overview} /> : <Skeleton />}
        </div>
      </Window>
    </div>
  );
}

interface DetailsProps {
  overview: Overview;
}

function Details({ overview: o }: DetailsProps) {
  return (
    <div className="min-w-0 flex-1" aria-live="polite">
      <p className="flex items-center gap-2 text-base font-bold">
        {o.live && <span className="landing-live-dot shrink-0" aria-hidden />}
        {o.headline}
      </p>
      <p className="mt-1 text-xs">Smirnoff League, {o.season} season</p>
      <dl className="xp-summary landing-status-list mt-3">
        <dt>Standings leader</dt>
        <dd>
          {o.leader.name} ({o.leader.record})
        </dd>
        <dt>Last place</dt>
        <dd>
          {o.last.name} ({o.last.record})
        </dd>
        <dt>Ice leader</dt>
        <dd data-testid="ice-leader" className="flex flex-wrap items-center gap-x-2">
          {o.iceLeader ? (
            <>
              {o.iceLeader.name}
              <IceBadge count={o.iceLeader.total} />
              {o.iceLeader.tied > 0 && <span className="font-normal">+{o.iceLeader.tied} tied</span>}
            </>
          ) : (
            "Nobody yet"
          )}
        </dd>
        <dt>Ices this week</dt>
        <dd>{o.icesThisWeek} locked so far</dd>
        {o.icesLastWeek !== null && (
          <>
            <dt>Last week</dt>
            <dd>
              {o.icesLastWeek} {o.icesLastWeek === 1 ? "ice" : "ices"}
            </dd>
          </>
        )}
        {o.nextKickoff && (
          <>
            <dt>Next kickoff</dt>
            <dd>{o.nextKickoff}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading league status" className="landing-skeleton min-w-0 flex-1">
      <span className="w-3/4" />
      <span className="w-1/3" />
      {["w-2/3", "w-1/2", "w-3/5", "w-2/5", "w-1/2"].map((w, i) => (
        <span key={i} className={`${w} mt-2`} />
      ))}
    </div>
  );
}
