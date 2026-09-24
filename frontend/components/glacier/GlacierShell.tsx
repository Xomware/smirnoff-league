"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { Settings } from "@/components/settings/Settings";
import { Ticker } from "@/components/ticker/Ticker";
import { ChugReelPopup } from "@/components/videos/ChugReelPopup";
import { DrillContext, type DrillTarget, NavigateContext, ViewParamsContext } from "@/components/views/drill-link";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { track } from "@/lib/activity/tracker";
import { parseOpen } from "@/lib/desktop/deep-link";
import { REGISTRY, useWindowTitle } from "@/lib/desktop/registry";
import { patchParams, viewKey, windowId, type WindowParams } from "@/lib/desktop/windows";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useProfile } from "@/lib/profile/use-profile";
import { descriptionOf, type PageView, pagesFor, pageView, SECTIONS, sectionOf } from "@/lib/sections";
import { Effects } from "./Effects";
import { Crystal, FONTS, HEADER_ICICLES, Icicles, PANEL_ICICLES } from "./Frost";
import { GlacierHome } from "./GlacierHome";
import { GlacierTeams } from "./GlacierTeams";
import { GlacierTrouble } from "./GlacierTrouble";
import { ProfileMenu } from "./ProfileMenu";

import "./glacier.css";
import "./glacier-skin.css";
import "./glacier-layout.css";

// Pages outside the registry. The XP desktop covers them with the My Profile
// wizard, the tray and the team links in Standings.
const PAGES = {
  profile: { title: "My Profile", component: ProfileSettings },
  settings: { title: "Settings", component: Settings },
  teams: { title: "Teams", component: GlacierTeams },
};
type Page = keyof typeof PAGES;
const isPage = (kind: string): kind is Page => Object.hasOwn(PAGES, kind);

const HOME: PageView = { kind: "home", params: {} };

const urlOf = (view: PageView) => (view.kind === "home" ? "/" : `/?open=${windowId(view.kind, view.params)}`);

// A link can name several windows for the desktop; the last is the one it had in front.
function fromUrl(): PageView {
  const last = new URLSearchParams(window.location.search).get("open")?.split(",").at(-1) ?? "";
  if (isPage(last)) return { kind: last, params: {} };
  return parseOpen(window.location.search).at(-1) ?? HOME;
}

export function GlacierShell() {
  const [{ view, section }, setNav] = useState(() => {
    const view = fromUrl();
    return { view, section: sectionOf(view.kind) };
  });
  const isAdmin = useProfile().me?.isAdmin ?? false;
  const week = useDefaultWeek();
  const [searching, setSearching] = useState(false);
  const windowTitle = useWindowTitle();
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  const id = windowId(view.kind, view.params);
  const { kind, params } = view;
  const title = isPage(kind) ? PAGES[kind].title : windowTitle({ kind, params });
  const Body = isPage(kind) ? PAGES[kind].component : REGISTRY[kind].component;
  const subPages = pagesFor(section, isAdmin);
  const description = descriptionOf(kind);

  useEffect(() => {
    const onPop = () =>
      setNav((nav) => {
        const view = fromUrl();
        return { view, section: sectionOf(view.kind, nav.section) };
      });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (to: PageView) => {
    if (windowId(to.kind, to.params) === id) return;
    setNav({ view: to, section: sectionOf(to.kind, section) });
    window.history.pushState(null, "", urlOf(to));
    track("open", windowId(to.kind, to.params));
    if (page.current) page.current.scrollTop = 0;
    // The clicked link may unmount with the old view, so focus lands on the new title.
    heading.current?.focus({ preventScroll: true });
  };
  const drill = ({ kind, ...params }: DrillTarget) => go({ kind, params });
  // A tab or filter switch stays on the page, so it replaces the page's history entry.
  const patch = (next: WindowParams) => {
    const to = { kind, params: patchParams(params, next) };
    setNav((nav) => ({ ...nav, view: to }));
    window.history.replaceState(null, "", urlOf(to));
  };

  const onNav = (e: MouseEvent, to: PageView) => {
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
          {SECTIONS.filter((s) => !s.account).map((s) => {
            const to = pageView(s.pages[0], week);
            return (
              <a key={s.id} href={urlOf(to)} aria-current={s === section ? "page" : undefined} onClick={(e) => onNav(e, to)}>
                {s.label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className="glacier-pill glacier-search"
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => setSearching(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
        <GlacierTrouble />
        <NotificationBell onOpen={() => go({ kind: "notifications", params: {} })} />
        <ProfileMenu urlOf={urlOf} onNav={onNav} />
      </header>
      <DrillContext.Provider value={drill}>
        <Ticker />
        <ChugReelPopup />
      </DrillContext.Provider>
      {subPages.length > 1 && (
        <nav aria-label={`${section.label} pages`} className="glacier-subnav">
          {subPages.map((p) => {
            const to = pageView(p, week);
            return (
              <a key={p.kind} href={urlOf(to)} aria-current={p.kind === kind ? "page" : undefined} onClick={(e) => onNav(e, to)}>
                {p.label}
              </a>
            );
          })}
        </nav>
      )}
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
                {description && <p className="glacier-lede">{description}</p>}
                <section className="glacier-panel" aria-label={title}>
                  <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
                  <Crystal />
                  <WindowBoundary key={viewKey(kind, params)}>
                    <ViewParamsContext value={patch}>
                      <Body params={params} />
                    </ViewParamsContext>
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
