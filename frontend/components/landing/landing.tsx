"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IceBottleIcon } from "@/components/xp/icons";
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
      <section className="landing-login flex min-h-svh flex-col">
        <div className="landing-band-top h-16 shrink-0" />
        <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 lg:flex-row lg:gap-0">
          <div className="flex flex-col items-center text-center lg:w-1/2 lg:items-end lg:pr-12 lg:text-right">
            <IceBottleIcon width={72} height={72} />
            <h1 className="landing-logo mt-3">
              Smirnoff League <span className="block text-[0.55em]">&rsquo;26-&rsquo;27</span>
            </h1>
            <div className="landing-boot-bar mt-5" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="mt-4 max-w-xs text-sm">
              14 managers. One closet. Please do not turn off your computer.
            </p>
          </div>
          <div className="landing-divider hidden self-stretch lg:block" aria-hidden />
          <div className="flex flex-col items-center lg:w-1/2 lg:items-start lg:pl-12">
            <p className="mb-3 text-sm">To begin, click your user name</p>
            <SignInTile onSignIn={onSignIn} />
          </div>
        </div>
        <div className="landing-band-bottom flex shrink-0 flex-col gap-1 px-6 py-5 text-sm sm:flex-row sm:justify-between">
          <span>After you log on, you can blame the waiver wire.</span>
          <a href="#how-ice-works" className="landing-link font-bold">
            Explain the ice thing
          </a>
        </div>
      </section>

      <LeagueStatus />

      <section id="how-ice-works" className="flex flex-col items-center gap-6 px-4 py-16 sm:px-8">
        <SectionHeading kicker="Rule book, sort of" title="How ice works" />
        <RuleDialog title="Critical Error: zero means ice" icon={<ErrorIcon />} buttons={["OK", "Cry"]}>
          <p>Any starter who scores 0.0 or less means an ice.</p>
          <p>That includes an empty slot and a player on bye. You set the lineup. You own it.</p>
        </RuleDialog>
        <RuleDialog title="Critical Error: lowest score" icon={<WarningIcon />} buttons={["Retry", "Abort"]} className="sm:ml-24">
          <p>The lowest scoring team of the week owes an extra ice.</p>
          <p>Stacks with the zeroes above. Ties all owe.</p>
        </RuleDialog>
        <section data-reveal aria-label="You've got ice: the deadline" className="landing-balloon sm:mr-24">
          <p className="flex items-center gap-2 font-bold">
            <EnvelopeIcon width={24} height={24} /> You&rsquo;ve got ice!
          </p>
          <p className="mt-2">Ices are due by the next Sunday at 1:00 PM.</p>
          <p className="mt-2">
            Every week late adds another ice for every ice still owed. Two owed and a week late is
            four to chug. Late ices don&rsquo;t earn late ices. We&rsquo;re not monsters.
          </p>
        </section>
      </section>

      <section className="flex flex-col items-center gap-6 px-4 py-16 sm:px-8">
        <SectionHeading kicker="Sundays, 1 PM onward" title="Ice Watch" />
        <div data-reveal className="w-full max-w-md">
          <IceWatchDemo animate={!reduced} />
        </div>
      </section>

      <section className="flex flex-col items-center gap-6 px-4 py-16 sm:px-8">
        <SectionHeading kicker="Weeks 15-17" title="The Toilet Bowl" />
        <RuleDialog title="The Toilet Bowl.exe" icon={<ErrorIcon />} buttons={["Send Error Report", "Don't Send"]}>
          <p className="font-bold">Smirnoff League has encountered a problem and needs to close you in a closet.</p>
          <p>
            Lose every toilet bowl game and you get the punishment: a dark closet, just a head lamp,
            and a 300-piece puzzle.
          </p>
          <p>We are sorry for the inconvenience. We are not sorry.</p>
        </RuleDialog>
      </section>

      <footer className="landing-footer flex flex-col items-center gap-4 px-4 pt-16 pb-24 text-center">
        <h2 className="landing-logo text-2xl">Ready to log on?</h2>
        <SignInTile onSignIn={onSignIn} />
        <p className="max-w-sm text-xs">
          A private league for friends. Not affiliated with any vodka, beverage or puzzle company.
        </p>
      </footer>
    </main>
  );
}

function SignInTile({ onSignIn }: LandingProps) {
  return (
    <>
      <button type="button" onClick={onSignIn} disabled={!onSignIn} className="landing-tile">
        <span className="landing-tile-avatar">
          <IceBottleIcon width={40} height={40} />
        </span>
        <span className="landing-tile-name">Sign in with Google</span>
      </button>
      {!onSignIn && <p className="mt-2 text-xs">Sign-in is switched off on this build.</p>}
    </>
  );
}

interface SectionHeadingProps {
  kicker: string;
  title: string;
}

function SectionHeading({ kicker, title }: SectionHeadingProps) {
  return (
    <div className="landing-heading text-center">
      <p className="text-xs font-bold tracking-widest uppercase">{kicker}</p>
      <h2 className="landing-logo text-3xl">{title}</h2>
    </div>
  );
}

interface RuleDialogProps {
  title: string;
  icon: ReactNode;
  buttons: string[];
  className?: string;
  children: ReactNode;
}

function RuleDialog({ title, icon, buttons, className = "", children }: RuleDialogProps) {
  return (
    <div data-reveal className={`w-full max-w-md ${className}`}>
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
