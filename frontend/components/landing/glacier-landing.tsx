"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { Effects } from "@/components/glacier/Effects";
import { Crystal, FONTS, HEADER_ICICLES, Icicles, PANEL_ICICLES } from "@/components/glacier/Frost";
import { IceBadge } from "@/components/xp/IceBadge";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import { useIceDrop } from "./ice-watch-demo";
import { Details, Skeleton, useOverview } from "./league-status";

import "@/components/glacier/glacier.css";
import "./glacier-landing.css";

interface GlacierLandingProps {
  onSignIn?: () => void;
  headerAction?: ReactNode;
}

export function GlacierLanding({ onSignIn, headerAction }: GlacierLandingProps) {
  const reduced = useReducedMotion();

  return (
    <div data-theme="glacier" className="gl">
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <Effects />
      <header className="gl-header">
        <Icicles className="glacier-header-icicles" d={HEADER_ICICLES} />
        <span className="gl-brand">
          <Image src="/brand/crest.png" alt="" width={44} height={52} className="glacier-crest" />
          Smirnoff League
        </span>
        {headerAction && <div className="gl-header-action">{headerAction}</div>}
      </header>

      <main className="gl-main">
        <section aria-label="Welcome" className="gl-hero">
          <div className="gl-hero-copy">
            <p className="gl-season">&rsquo;26-&rsquo;27 season · 14 managers</p>
            <h1 className="gl-title">
              Every zero <span>is an ice.</span>
            </h1>
            <p className="gl-lede">
              Scores, standings, brackets and the ice ledger for the whole Smirnoff League. Sign in to see what you owe.
            </p>
            <SignIn onSignIn={onSignIn} />
          </div>
          <div className="gl-orb">
            <Image
              src="/brand/mascot.png"
              alt="The league mascot, a robot chugging a Smirnoff Ice"
              width={365}
              height={400}
              priority
            />
          </div>
        </section>

        <div className="gl-grid">
          <Status />
          <Panel label="Ice Watch" kicker="Sundays, 1 PM onward" className="gl-watch">
            <Watch animate={!reduced} />
          </Panel>
          <Panel label="Zero means ice" kicker="Rule 1" className="gl-rule">
            <p>Any starter who scores 0.0 or less is an ice.</p>
            <p>An empty slot or a player on bye counts. You set the lineup.</p>
          </Panel>
          <Panel label="Lowest score" kicker="Rule 2" className="gl-rule">
            <p>The lowest scoring team of the week owes one more. Ties all owe.</p>
          </Panel>
          <Panel label="The deadline" kicker="Rule 3" className="gl-rule">
            <p>Ices are due by the next Sunday at 1:00 PM.</p>
            <p>Each late week adds another ice for every ice still owed. Late ices don&rsquo;t earn late ices.</p>
          </Panel>
          <Panel label="The Toilet Bowl" kicker="Weeks 15-17" className="gl-bowl">
            <p className="gl-strong">Smirnoff League has encountered a problem: you.</p>
            <p>Lose every toilet bowl game and you finish dead last, with the league punishment to match.</p>
            <p>We are sorry for the inconvenience. We are not sorry.</p>
          </Panel>
        </div>
      </main>

      <footer className="gl-footer">
        <h2 className="gl-footer-title">Ready to log on?</h2>
        <SignIn onSignIn={onSignIn} />
        <p className="gl-fine">
          A private league for friends. Not affiliated with any vodka or beverage company. <a href="/privacy/">Privacy</a>
        </p>
      </footer>
    </div>
  );
}

interface PanelProps {
  label: string;
  kicker: string;
  className: string;
  children: ReactNode;
}

function Panel({ label, kicker, className, children }: PanelProps) {
  return (
    <section aria-label={label} className={`glacier-panel gl-panel ${className}`}>
      <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
      <Crystal />
      <p className="gl-kicker">{kicker}</p>
      <h2 className="gl-panel-title">{label}</h2>
      {children}
    </section>
  );
}

// Hidden on any failure, like the XP window: a broken widget shouldn't argue with the sign-in.
function Status() {
  const state = useOverview();
  if (state.status === "error") return null;
  return (
    <Panel label="This week in the league" kicker="The league, live" className="gl-status">
      {state.status === "ok" ? <Details overview={state.overview} /> : <Skeleton />}
    </Panel>
  );
}

function Watch({ animate }: { animate: boolean }) {
  const { ices, row, pts, week, weeks } = useIceDrop(animate);
  return (
    <>
      <p className="gl-live">
        <span className="landing-live-dot" aria-hidden />
        Live <span>Demo data. Fake player, real consequences.</span>
      </p>
      <ul>
        <li ref={row} data-testid="ice-watch-row" className="gl-watch-row ice">
          <span className="gl-watch-pos">WR</span>
          <span className="gl-watch-name">
            Demo Receiver <span ref={week}>Week {weeks}</span>
          </span>
          <IceBadge count={ices} />
          <span ref={pts} className="gl-watch-pts">
            0.00
          </span>
        </li>
      </ul>
      <p className="gl-quiet">When a starter hits zero the row freezes over and the badge ticks up.</p>
    </>
  );
}

function SignIn({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <div className="gl-signin-wrap">
      <button type="button" onClick={onSignIn} disabled={!onSignIn} className="gl-signin">
        <Image src="/brand/robot-head.png" alt="" width={36} height={35} />
        Sign in with Google
      </button>
      {!onSignIn && <p className="gl-quiet">Sign-in is switched off on this build.</p>}
    </div>
  );
}
