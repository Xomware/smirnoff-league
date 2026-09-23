"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { track, viewTarget } from "@/lib/activity/tracker";
import { parseOpen } from "@/lib/desktop/deep-link";
import { REGISTRY, useWindowTitle, type WindowKind } from "@/lib/desktop/registry";
import { windowId, type WindowView } from "@/lib/desktop/windows";
import { Effects } from "./Effects";

import "./glacier.css";

const FONTS = "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Figtree:wght@400;500;600;700;800&display=swap";

const NAV: { label: string; kind: WindowKind }[] = [
  { label: "Home", kind: "home" },
  { label: "Games", kind: "scores" },
  { label: "Ices", kind: "ices" },
  { label: "Rankings", kind: "chug-rankings" },
  { label: "League", kind: "standings" },
  { label: "News Drop", kind: "writeup" },
];

const HOME: WindowView = { kind: "home", params: {} };

const urlOf = (view: WindowView) => (view.kind === "home" ? "/" : `/?open=${windowId(view.kind, view.params)}`);

// A link can name several windows for the desktop; the last is the one it had in front.
const fromUrl = (): WindowView => parseOpen(window.location.search).at(-1) ?? HOME;

function Icicles({ className, d }: { className: string; d: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 400 22" preserveAspectRatio="none">
      <path d={d} />
    </svg>
  );
}

const HEADER_ICICLES =
  "M0 0H400V2H392L389 12L386 2H360L357 16L354 2H330L327 8L324 2H296L292 18L288 2H262L259 10L256 2H228L224 15L220 2H196L193 9L190 2H162L158 17L154 2H128L125 10L122 2H96L92 14L88 2H62L59 8L56 2H30L26 16L22 2H0Z";
const PANEL_ICICLES =
  "M0 0H400V3H394L391 15L388 3H372L368 20L364 3H340L337 11L334 3H310L306 18L302 3H276L273 9L270 3H246L242 21L238 3H214L211 12L208 3H180L176 17L172 3H150L147 10L144 3H118L114 19L110 3H86L83 11L80 3H58L54 16L50 3H28L25 9L22 3H0Z";

function Crystal() {
  return (
    <svg className="glacier-crystal" aria-hidden="true" viewBox="0 0 60 60">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M30 4V56M7 17L53 43M7 43L53 17" />
        <path d="M30 12L25 7M30 12L35 7M30 48L25 53M30 48L35 53M14 21L8 23M14 21L12 15M46 39L52 37M46 39L48 45M14 39L12 45M14 39L8 37M46 21L48 15M46 21L52 23" />
      </g>
    </svg>
  );
}

interface GlacierShellProps {
  onSwitchTheme: () => void;
}

export function GlacierShell({ onSwitchTheme }: GlacierShellProps) {
  const [view, setView] = useState(fromUrl);
  const [searching, setSearching] = useState(false);
  const title = useWindowTitle()(view);
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  const id = windowId(view.kind, view.params);
  const { component: Body } = REGISTRY[view.kind];

  useEffect(() => {
    const onPop = () => setView(fromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (to: WindowView) => {
    if (windowId(to.kind, to.params) === id) return;
    setView(to);
    window.history.pushState(null, "", urlOf(to));
    track("open", viewTarget(to));
    if (page.current) page.current.scrollTop = 0;
    // The clicked link may unmount with the old view, so focus lands on the new title.
    heading.current?.focus({ preventScroll: true });
  };
  const drill = ({ kind, ...params }: DrillTarget) => go({ kind, params });

  const onNav = (e: MouseEvent, to: WindowView) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to);
  };

  return (
    <div data-theme="glacier" className="glacier">
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <header className="glacier-header">
        <Icicles className="glacier-header-icicles" d={HEADER_ICICLES} />
        <a href={urlOf(HOME)} className="glacier-brand" onClick={(e) => onNav(e, HOME)}>
          <Image src="/brand/crest.png" alt="" width={44} height={52} className="glacier-crest" />
          <span>Smirnoff League</span>
        </a>
        <nav aria-label="Main" className="glacier-nav">
          {NAV.map(({ label, kind }) => {
            const to = { kind, params: {} };
            return (
              <a key={kind} href={urlOf(to)} aria-current={view.kind === kind ? "page" : undefined} onClick={(e) => onNav(e, to)}>
                {label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className="glacier-pill glacier-search"
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => setSearching(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Search
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
        <button type="button" className="glacier-pill" onClick={onSwitchTheme}>
          Classic XP
        </button>
        <NotificationBell onOpen={() => go({ kind: "notifications", params: {} })} />
      </header>
      <DrillContext.Provider value={drill}>
        <NavigateContext value={drill}>
          <main ref={page} className="glacier-page">
            <h1 ref={heading} tabIndex={-1} className="glacier-title">
              {title}
            </h1>
            <section className="glacier-panel" aria-label={title}>
              <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
              <Crystal />
              <WindowBoundary key={id}>
                <Body params={view.params} />
              </WindowBoundary>
            </section>
          </main>
        </NavigateContext>
      </DrillContext.Provider>
      <CommandPalette phone={false} open={searching} onOpenChange={setSearching} onGo={({ kind, params }) => go({ kind, params })} />
      <Effects />
    </div>
  );
}
