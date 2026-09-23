"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";

import { Window } from "@/components/xp/Window";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import { EnvelopeIcon, ErrorIcon, WarningIcon } from "./dialog-icons";
import { IceWatchDemo } from "./ice-watch-demo";
import { LeagueStatus } from "./league-status";
import "./landing.css";

interface LandingProps {
  // Absent when this build has no Cognito config, which leaves the button disabled.
  onSignIn?: () => void;
}

export function Landing({ onSignIn }: LandingProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);

  // Each [data-reveal] pops in once, the first time it scrolls into view. The
  // flag is written to the DOM rather than state so a reveal re-renders nothing.
  useEffect(() => {
    const el = root.current;
    if (reduced || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.shown = "";
          io.unobserve(e.target);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    for (const target of el.querySelectorAll("[data-reveal]")) io.observe(target);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <main ref={root} className="landing overflow-x-hidden" data-motion={reduced ? "off" : "on"}>
      <section aria-label="Welcome" className="landing-hero">
        <div className="landing-hero-body">
          <Image
            src="/brand/crest.png"
            alt="Smirnoff Ice Fantasy Football League crest"
            width={640}
            height={776}
            priority
            className="landing-crest"
          />
          <h1 className="landing-title">
            Smirnoff League <span className="landing-season">&rsquo;26-&rsquo;27 season</span>
          </h1>
          <p className="landing-tagline">14 managers. Every zero is an ice.</p>
          <SignInButton onSignIn={onSignIn} />
        </div>
        <a href="#the-league" className="landing-cue">
          Scroll for the rules
          <ChevronIcon />
        </a>
      </section>

      <section id="the-league" className="landing-band landing-band-mist">
        <SectionHeading kicker="The league, live" title="This week in the league" />
        <p className="landing-lede">Scores, standings, brackets and the ice ledger for all 14 teams. Sign in to see yours.</p>
        <LeagueStatus />
      </section>

      <section id="how-ice-works" className="landing-band landing-band-white">
        <SectionHeading kicker="The rule book" title="How ice works" />
        <div className="landing-rules">
          <Image src="/brand/mascot.png" alt={MASCOT_ALT} width={365} height={400} className="landing-mascot" />
          <div className="flex w-full max-w-md flex-col gap-6">
            <RuleDialog title="Critical Error: zero means ice" icon={<ErrorIcon />} buttons={["OK", "Cry"]}>
              <p>Any starter who scores 0.0 or less is an ice.</p>
              <p>An empty slot or a player on bye counts. You set the lineup.</p>
            </RuleDialog>
            <RuleDialog title="Critical Error: lowest score" icon={<WarningIcon />} buttons={["Retry", "Abort"]}>
              <p>The lowest scoring team of the week owes one more. Ties all owe.</p>
            </RuleDialog>
            <section data-reveal aria-label="You've got ice: the deadline" className="landing-balloon">
              <p className="flex items-center gap-2 font-bold">
                <EnvelopeIcon width={24} height={24} /> You&rsquo;ve got ice!
              </p>
              <p className="mt-2">Ices are due by the next Sunday at 1:00 PM.</p>
              <p className="mt-2">
                Each late week adds another ice for every ice still owed. Late ices don&rsquo;t earn late ices.
              </p>
            </section>
          </div>
        </div>
      </section>

      <section className="landing-band landing-band-navy">
        <SectionHeading kicker="Sundays, 1 PM onward" title="Ice Watch" />
        <div className="landing-watch">
          <div data-reveal className="w-full max-w-md">
            <IceWatchDemo animate={!reduced} />
          </div>
          <Image src="/brand/mascot.png" alt="" width={365} height={400} className="landing-mascot landing-mascot-flip" />
        </div>
      </section>

      <section className="landing-band landing-band-mist">
        <SectionHeading kicker="Weeks 15-17" title="The Toilet Bowl" />
        <RuleDialog title="The Toilet Bowl.exe" icon={<ErrorIcon />} buttons={["Send Error Report", "Don't Send"]}>
          <p className="font-bold">Smirnoff League has encountered a problem: you.</p>
          <p>Lose every toilet bowl game and you finish dead last, with the league punishment to match.</p>
          <p>We are sorry for the inconvenience. We are not sorry.</p>
        </RuleDialog>
      </section>

      <footer className="landing-footer">
        <div className="flex flex-col items-center gap-5 px-4 py-16 text-center">
          <h2 className="landing-title text-3xl">Ready to log on?</h2>
          <SignInButton onSignIn={onSignIn} />
        </div>
        <div className="landing-taskbar">
          <span className="landing-taskbar-task">
            <Image src="/brand/robot-head.png" alt="" width={20} height={19} />
            Smirnoff League
          </span>
          <span className="landing-taskbar-tray">
            <span>
              A private league for friends. Not affiliated with any vodka or beverage company.{" "}
              <a href="/privacy/">Privacy</a>
            </span>
          </span>
        </div>
      </footer>
    </main>
  );
}

const MASCOT_ALT = "The league mascot, a robot chugging a Smirnoff Ice";

function SignInButton({ onSignIn }: LandingProps) {
  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={onSignIn} disabled={!onSignIn} className="landing-signin">
        <Image src="/brand/robot-head.png" alt="" width={40} height={39} />
        Sign in with Google
      </button>
      {!onSignIn && <p className="mt-2 text-xs">Sign-in is switched off on this build.</p>}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden focusable="false" className="landing-cue-chevron">
      <path d="M5 8l7 7 7-7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SectionHeadingProps {
  kicker: string;
  title: string;
}

function SectionHeading({ kicker, title }: SectionHeadingProps) {
  return (
    <div className="landing-heading">
      <p className="landing-kicker">{kicker}</p>
      <h2 className="landing-title text-3xl sm:text-4xl">{title}</h2>
    </div>
  );
}

interface RuleDialogProps {
  title: string;
  icon: ReactNode;
  buttons: string[];
  children: ReactNode;
}

function RuleDialog({ title, icon, buttons, children }: RuleDialogProps) {
  return (
    <div data-reveal className="w-full max-w-md">
      <Window title={title}>
        <div className="flex gap-3 text-sm leading-relaxed">
          <span className="shrink-0">{icon}</span>
          <div className="flex flex-col gap-2">{children}</div>
        </div>
        {/* Chrome only, like the title bar controls: these buttons do nothing. */}
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-hidden>
          {buttons.map((b) => (
            <span key={b} className="landing-faux-button">
              {b}
            </span>
          ))}
        </div>
      </Window>
    </div>
  );
}
