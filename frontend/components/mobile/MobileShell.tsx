"use client";

import Image from "next/image";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { Effects } from "@/components/glacier/Effects";
import { HEADER_ICICLES, Icicles } from "@/components/glacier/Frost";
import { GlacierPhoneHome, LINE_ICONS, LineIcon } from "@/components/glacier/GlacierPhone";
import { MenuDrawer } from "@/components/glacier/MenuDrawer";
import { FONTS } from "@/components/glacier/Frost";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { BackArrowIcon, HomeIcon, IceBottleIcon, MenuIcon, ScoresIcon, SearchIcon } from "@/components/xp/icons";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { track } from "@/lib/activity/tracker";
import { REGISTRY, useWindowTitle, type WindowKind } from "@/lib/desktop/registry";
import type { WindowParams } from "@/lib/desktop/windows";
import { useLeague } from "@/lib/league/use-league";
import { foldedInto, type Screen, type ScreenKind, screenId, stackOf, type Tab, TABS } from "@/lib/phone/nav";
import { usePhoneNav } from "@/lib/phone/use-phone-nav";
import { GameScreen } from "./GameScreen";
import { GamesScreen } from "./GamesScreen";
import { HomeScreen } from "./HomeScreen";
import { IcesScreen } from "./IcesScreen";
import { MenuScreen, TeamsScreen } from "./MenuScreen";
import { PlayerScreen } from "./PlayerScreen";
import { PushContext } from "./push";
import { StandingsScreen } from "./StandingsScreen";
import { StatsScreen } from "./StatsScreen";
import { MyTeamScreen, TeamScreen } from "./TeamScreen";

import "./mobile.css";
import "@/components/glacier/glacier.css";
import "@/components/glacier/glacier-skin.css";
import "@/components/glacier/glacier-phone.css";

type Body = ComponentType<{ params: WindowParams }>;

const PHONE_SCREENS = { games: GamesScreen, menu: MenuScreen, teams: TeamsScreen } satisfies Record<
  Exclude<ScreenKind, WindowKind>,
  Body
>;
const OVERRIDES: Partial<Record<WindowKind, Body>> = {
  home: HomeScreen,
  ices: IcesScreen,
  week: GamesScreen,
  game: GameScreen,
  standings: StandingsScreen,
  stats: StatsScreen,
  team: TeamScreen,
  "my-team": MyTeamScreen,
  player: PlayerScreen,
};

const isPhoneKind = (kind: ScreenKind): kind is keyof typeof PHONE_SCREENS => kind in PHONE_SCREENS;
const bodyOf = (kind: ScreenKind): Body => (isPhoneKind(kind) ? PHONE_SCREENS[kind] : (OVERRIDES[kind] ?? REGISTRY[kind].component));

const TAB_BAR: Record<Tab, { label: string; Icon: typeof HomeIcon }> = {
  home: { label: "Home", Icon: HomeIcon },
  games: { label: "Games", Icon: ScoresIcon },
  ices: { label: "Ices", Icon: IceBottleIcon },
  menu: { label: "Menu", Icon: MenuIcon },
};

function useScreenTitle(): (screen: Screen) => string {
  const windowTitle = useWindowTitle();
  const { data, teamFor } = useLeague();
  return ({ kind, params }) => {
    switch (kind) {
      case "home":
        return "Smirnoff League";
      case "games":
      case "menu":
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

interface MobileShellProps {
  theme?: "xp" | "glacier";
}

export function MobileShell({ theme = "xp" }: MobileShellProps) {
  const glacier = theme === "glacier";
  const { nav, push, selectTab, back } = usePhoneNav();
  const title = useScreenTitle();
  const heading = useRef<HTMLHeadingElement>(null);
  const stack = stackOf(nav);
  const top = stack[stack.length - 1];
  const topKey = `${nav.tab}/${stack.length}/${screenId(top)}`;
  const shown = useRef(topKey);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerId = useId();

  // The tapped link is now on a hidden screen, so hand focus to the new title.
  useEffect(() => {
    if (shown.current === topKey) return;
    shown.current = topKey;
    heading.current?.focus({ preventScroll: true });
  }, [topKey]);

  const go = ({ kind, params }: Screen) => {
    const tab = foldedInto(kind);
    if (tab) return selectTab(tab);
    push({ kind, params });
  };
  const open = ({ kind, ...params }: DrillTarget) => go({ kind, params });
  // Glacier's Menu is a drawer over the current screen, not a tab of its own.
  const onTab = (tab: Tab) => {
    if (!glacier || tab !== "menu") return selectTab(tab);
    setMenuOpen(true);
    track("open", "tab:menu");
  };
  const pushFromMenu = (screen: Screen) => {
    setMenuOpen(false);
    push(screen);
  };

  return (
    <div className={glacier ? "m-app glacier" : "m-app"} data-theme={glacier ? "glacier" : undefined}>
      {glacier && <link rel="stylesheet" href={FONTS} precedence="default" />}
      <header className="m-bar">
        {glacier && <Icicles className="m-bar-icicles" d={HEADER_ICICLES} />}
        {stack.length > 1 ? (
          <button type="button" className="m-back" aria-label="Back" onClick={back}>
            {glacier ? <LineIcon d={LINE_ICONS.back} size={26} /> : <BackArrowIcon width={30} height={30} />}
          </button>
        ) : (
          glacier && <Image src="/brand/crest.png" alt="" width={32} height={38} className="m-crest" />
        )}
        <h1 ref={heading} tabIndex={-1} className="m-title">
          {title(top)}
        </h1>
        <button type="button" className="m-search" aria-label="Search" onClick={() => setSearching(true)}>
          {glacier ? <LineIcon d={LINE_ICONS.search} /> : <SearchIcon width={24} height={24} />}
        </button>
        <NotificationBell onOpen={() => top.kind !== "notifications" && push({ kind: "notifications", params: {} })} />
      </header>
      <PushContext value={push}>
        <DrillContext.Provider value={open}>
          <NavigateContext value={open}>
            <main className="m-screens">
              {TABS.flatMap((tab) =>
                (nav.stacks[tab] ?? []).map((screen, i, all) => {
                  const Body = glacier && screen.kind === "home" ? GlacierPhoneHome : bodyOf(screen.kind);
                  return (
                    // Screens under the top one stay mounted, so Back returns to
                    // them as they were left: scroll, week picked.
                    <section
                      key={`${tab}/${i + 1}/${screenId(screen)}`}
                      className="m-screen"
                      aria-label={title(screen)}
                      hidden={tab !== nav.tab || i !== all.length - 1}
                    >
                      {screen.kind === "home" && (
                        <div className="m-theme-row">
                          <ThemeToggle />
                        </div>
                      )}
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
      <nav className={glacier ? "m-tabs m-tabs-pill" : "m-tabs"} aria-label="Tabs">
        {TABS.map((tab) => {
          const { label, Icon } = TAB_BAR[tab];
          const drawer = glacier && tab === "menu";
          return (
            <button
              key={tab}
              type="button"
              className="m-tab"
              aria-current={tab === nav.tab ? "page" : undefined}
              aria-haspopup={drawer ? "dialog" : undefined}
              aria-expanded={drawer ? menuOpen : undefined}
              aria-controls={drawer ? drawerId : undefined}
              onClick={() => onTab(tab)}
            >
              {glacier ? <LineIcon d={LINE_ICONS[tab]} /> : <Icon width={24} height={24} />}
              {label}
            </button>
          );
        })}
      </nav>
      <CommandPalette
        phone
        open={searching}
        onOpenChange={setSearching}
        onGo={go}
      />
      {glacier && (
        <PushContext value={pushFromMenu}>
          <MenuDrawer id={drawerId} open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuScreen />
          </MenuDrawer>
        </PushContext>
      )}
      {glacier && <Effects />}
    </div>
  );
}
