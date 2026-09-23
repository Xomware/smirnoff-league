"use client";

import { type ComponentType, useEffect, useRef } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { IcesWindow } from "@/components/windows/IcesWindow";
import { BackArrowIcon, HomeIcon, IceBottleIcon, ScoresIcon, StandingsIcon } from "@/components/xp/icons";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { REGISTRY, useWindowTitle, type WindowKind } from "@/lib/desktop/registry";
import type { WindowParams } from "@/lib/desktop/windows";
import { useLeague } from "@/lib/league/use-league";
import { foldedInto, type Screen, type ScreenKind, screenId, stackOf, type Tab, TABS } from "@/lib/phone/nav";
import { usePhoneNav } from "@/lib/phone/use-phone-nav";
import { GameScreen } from "./GameScreen";
import { GamesScreen } from "./GamesScreen";
import { HomeScreen } from "./HomeScreen";
import { LeagueScreen, TeamsScreen } from "./LeagueScreen";
import { PushContext } from "./push";

import "./mobile.css";

type Body = ComponentType<{ params: WindowParams }>;

const PHONE_SCREENS = { games: GamesScreen, league: LeagueScreen, teams: TeamsScreen, game: GameScreen } satisfies Record<
  Exclude<ScreenKind, WindowKind>,
  Body
>;
const OVERRIDES: Partial<Record<WindowKind, Body>> = { home: HomeScreen, ices: IcesWindow, week: GamesScreen };

const isPhoneKind = (kind: ScreenKind): kind is keyof typeof PHONE_SCREENS => kind in PHONE_SCREENS;
const bodyOf = (kind: ScreenKind): Body => (isPhoneKind(kind) ? PHONE_SCREENS[kind] : (OVERRIDES[kind] ?? REGISTRY[kind].component));

const TAB_BAR: Record<Tab, { label: string; Icon: typeof HomeIcon }> = {
  home: { label: "Home", Icon: HomeIcon },
  games: { label: "Games", Icon: ScoresIcon },
  ices: { label: "Ices", Icon: IceBottleIcon },
  league: { label: "League", Icon: StandingsIcon },
};

function useScreenTitle(): (screen: Screen) => string {
  const windowTitle = useWindowTitle();
  const { data, teamFor } = useLeague();
  return ({ kind, params }) => {
    switch (kind) {
      case "home":
        return "Smirnoff League";
      case "games":
      case "league":
      case "teams":
      case "ices":
        return kind.charAt(0).toUpperCase() + kind.slice(1);
      case "game":
      case "week":
        return `Week ${params.week}`;
      case "team":
        return data ? teamFor(Number(params.rosterId)).name : "Team";
      case "writeup":
        return "News Drop";
      default:
        return windowTitle({ kind, params });
    }
  };
}

export function MobileShell() {
  const { nav, push, selectTab, back } = usePhoneNav();
  const title = useScreenTitle();
  const heading = useRef<HTMLHeadingElement>(null);
  const stack = stackOf(nav);
  const top = stack[stack.length - 1];
  const topKey = `${nav.tab}/${stack.length}/${screenId(top)}`;
  const shown = useRef(topKey);

  // The tapped link is now on a hidden screen, so hand focus to the new title.
  useEffect(() => {
    if (shown.current === topKey) return;
    shown.current = topKey;
    heading.current?.focus({ preventScroll: true });
  }, [topKey]);

  const open = ({ kind, ...params }: DrillTarget) => {
    const tab = foldedInto(kind);
    if (tab) return selectTab(tab);
    push({ kind, params });
  };

  return (
    <div className="m-app">
      <header className="m-bar">
        {stack.length > 1 && (
          <button type="button" className="m-back" aria-label="Back" onClick={back}>
            <BackArrowIcon width={30} height={30} />
          </button>
        )}
        <h1 ref={heading} tabIndex={-1} className="m-title">
          {title(top)}
        </h1>
        <NotificationBell onOpen={() => top.kind !== "notifications" && push({ kind: "notifications", params: {} })} />
      </header>
      <PushContext value={push}>
        <DrillContext.Provider value={open}>
          <NavigateContext value={open}>
            <main className="m-screens">
              {TABS.flatMap((tab) =>
                (nav.stacks[tab] ?? []).map((screen, i, all) => {
                  const Body = bodyOf(screen.kind);
                  return (
                    // Screens under the top one stay mounted, so Back returns to
                    // them as they were left: scroll, week picked.
                    <section
                      key={`${tab}/${i + 1}/${screenId(screen)}`}
                      className="m-screen"
                      aria-label={title(screen)}
                      hidden={tab !== nav.tab || i !== all.length - 1}
                    >
                      <WindowBoundary>
                        <Body params={screen.params} />
                      </WindowBoundary>
                    </section>
                  );
                }),
              )}
            </main>
          </NavigateContext>
        </DrillContext.Provider>
      </PushContext>
      <nav className="m-tabs" aria-label="Tabs">
        {TABS.map((tab) => {
          const { label, Icon } = TAB_BAR[tab];
          return (
            <button
              key={tab}
              type="button"
              className="m-tab"
              aria-current={tab === nav.tab ? "page" : undefined}
              onClick={() => selectTab(tab)}
            >
              <Icon width={24} height={24} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
