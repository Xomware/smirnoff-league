"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { Settings } from "@/components/settings/Settings";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { track } from "@/lib/activity/tracker";
import { parseOpen } from "@/lib/desktop/deep-link";
import { REGISTRY, useWindowTitle, type WindowKind } from "@/lib/desktop/registry";
import { windowId, type WindowParams } from "@/lib/desktop/windows";
import { Effects } from "./Effects";
import { Crystal, FONTS, HEADER_ICICLES, Icicles, PANEL_ICICLES } from "./Frost";
import { GlacierHome } from "./GlacierHome";
import { GlacierTrouble } from "./GlacierTrouble";
import { ProfileMenu } from "./ProfileMenu";

import "./glacier.css";
import "./glacier-skin.css";

const NAV: { label: string; kind: WindowKind }[] = [
  { label: "Home", kind: "home" },
  { label: "Games", kind: "scores" },
  { label: "Ices", kind: "ices" },
  { label: "Rankings", kind: "chug-rankings" },
  { label: "League", kind: "standings" },
  { label: "News Drop", kind: "writeup" },
];

// Glacier's own pages. The desktop reaches the same things through the
// Start menu's My Profile wizard and the tray.
const PAGES = {
  profile: { title: "My Profile", component: ProfileSettings },
  settings: { title: "Settings", component: Settings },
};
type Page = keyof typeof PAGES;
const isPage = (kind: string): kind is Page => Object.hasOwn(PAGES, kind);

export interface GlacierView {
  kind: WindowKind | Page;
  params: WindowParams;
}

const HOME: GlacierView = { kind: "home", params: {} };

const urlOf = (view: GlacierView) => (view.kind === "home" ? "/" : `/?open=${windowId(view.kind, view.params)}`);

// A link can name several windows for the desktop; the last is the one it had in front.
function fromUrl(): GlacierView {
  const last = new URLSearchParams(window.location.search).get("open")?.split(",").at(-1) ?? "";
  if (isPage(last)) return { kind: last, params: {} };
  return parseOpen(window.location.search).at(-1) ?? HOME;
}

export function GlacierShell() {
  const [view, setView] = useState(fromUrl);
  const [searching, setSearching] = useState(false);
  const windowTitle = useWindowTitle();
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  const id = windowId(view.kind, view.params);
  const { kind, params } = view;
  const title = isPage(kind) ? PAGES[kind].title : windowTitle({ kind, params });
  const Body = isPage(kind) ? PAGES[kind].component : REGISTRY[kind].component;

  useEffect(() => {
    const onPop = () => setView(fromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (to: GlacierView) => {
    if (windowId(to.kind, to.params) === id) return;
    setView(to);
    window.history.pushState(null, "", urlOf(to));
    track("open", windowId(to.kind, to.params));
    if (page.current) page.current.scrollTop = 0;
    // The clicked link may unmount with the old view, so focus lands on the new title.
    heading.current?.focus({ preventScroll: true });
  };
  const drill = ({ kind, ...params }: DrillTarget) => go({ kind, params });

  const onNav = (e: MouseEvent, to: GlacierView) => {
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
        <GlacierTrouble />
        <ThemeToggle />
        <NotificationBell onOpen={() => go({ kind: "notifications", params: {} })} />
        <ProfileMenu urlOf={urlOf} onNav={onNav} />
      </header>
      <DrillContext.Provider value={drill}>
        <NavigateContext value={drill}>
          <main ref={page} className="glacier-page">
            {view.kind === "home" ? (
              <WindowBoundary key={id}>
                <GlacierHome ref={heading} />
              </WindowBoundary>
            ) : (
              <>
                <h1 ref={heading} tabIndex={-1} className="glacier-title">
                  {title}
                </h1>
                <section className="glacier-panel" aria-label={title}>
                  <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
                  <Crystal />
                  <WindowBoundary key={id}>
                    <Body params={params} />
                  </WindowBoundary>
                </section>
              </>
            )}
          </main>
        </NavigateContext>
      </DrillContext.Provider>
      <CommandPalette phone={false} open={searching} onOpenChange={setSearching} onGo={({ kind, params }) => go({ kind, params })} />
      <Effects />
    </div>
  );
}
