"use client";

import Image from "next/image";
import { type ComponentType, type UIEvent, useEffect, useId, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { Effects } from "@/components/glacier/Effects";
import { HEADER_ICICLES, Icicles } from "@/components/glacier/Frost";
import { GlacierHome } from "@/components/glacier/GlacierHome";
import { DrawerNav } from "@/components/glacier/DrawerNav";
import { LINE_ICONS, LineIcon } from "@/components/glacier/GlacierPhone";
import { GlacierTrouble } from "@/components/glacier/GlacierTrouble";
import { MenuDrawer } from "@/components/glacier/MenuDrawer";
import { FONTS } from "@/components/glacier/Frost";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { Settings } from "@/components/settings/Settings";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Ticker } from "@/components/ticker/Ticker";
import { ChugReelPopup } from "@/components/videos/ChugReelPopup";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { BackArrowIcon, HomeIcon, IceBottleIcon, MenuIcon, ScoresIcon, SearchIcon } from "@/components/xp/icons";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { TabParamContext } from "@/components/xp/Tabs";
import { track } from "@/lib/activity/tracker";
import { REGISTRY, useWindowTitle, type WindowKind } from "@/lib/desktop/registry";
import { viewKey, type WindowParams } from "@/lib/desktop/windows";
import { useDefaultWeek } from "@/lib/league/default-week";
import { useLeague } from "@/lib/league/use-league";
import { pageTab, rootOf, type Screen, type ScreenKind, screenId, sectionFor, stackOf, type Tab, TABS } from "@/lib/phone/nav";
import { usePhoneNav } from "@/lib/phone/use-phone-nav";
import { useProfile } from "@/lib/profile/use-profile";
import { type PageKind, pagesFor, pageView, SECTIONS } from "@/lib/sections";
import { GameScreen } from "./GameScreen";
import { GamesScreen } from "./GamesScreen";
import { HomeScreen } from "./HomeScreen";
import { IceStandingsScreen, LedgerScreen, VideosScreen } from "./IcesScreen";
import { MenuScreen, TeamsScreen } from "./MenuScreen";
import { PlayerScreen } from "./PlayerScreen";
import { PushContext } from "./push";
import { StandingsScreen } from "./StandingsScreen";
import { StatsScreen } from "./StatsScreen";
import { SubTabs } from "./SubTabs";
import { MyTeamScreen, TeamScreen } from "./TeamScreen";

import "./mobile.css";
import "@/components/glacier/glacier.css";
import "@/components/glacier/glacier-skin.css";
import "@/components/glacier/glacier-phone.css";
import "@/components/glacier/glacier-layout.css";

type Body = ComponentType<{ params: WindowParams }>;

const PHONE_SCREENS = {
  menu: MenuScreen,
  teams: TeamsScreen,
  profile: ProfileSettings,
  settings: Settings,
} satisfies Record<
  Exclude<ScreenKind, WindowKind>,
  Body
>;
const OVERRIDES: Partial<Record<WindowKind, Body>> = {
  home: HomeScreen,
  ices: LedgerScreen,
  "ice-standings": IceStandingsScreen,
  videos: VideosScreen,
  scores: GamesScreen,
  game: GameScreen,
  standings: StandingsScreen,
  stats: StatsScreen,
  team: TeamScreen,
  "my-team": MyTeamScreen,
  player: PlayerScreen,
};

const isPhoneKind = (kind: ScreenKind): kind is keyof typeof PHONE_SCREENS => kind in PHONE_SCREENS;
const bodyOf = (kind: ScreenKind): Body => (isPhoneKind(kind) ? PHONE_SCREENS[kind] : (OVERRIDES[kind] ?? REGISTRY[kind].component));

// XP's tab bar. League and News Drop open from its Menu, so Menu stays lit on them.
const TAB_BAR: { tab: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { tab: "home", label: "Home", Icon: HomeIcon },
  { tab: "games", label: "Games", Icon: ScoresIcon },
  { tab: "ices", label: "Ices", Icon: IceBottleIcon },
  { tab: "menu", label: "Menu", Icon: MenuIcon },
];

const GlacierPhoneHome = () => <GlacierHome phone />;

function useScreenTitle(): (screen: Screen) => string {
  const windowTitle = useWindowTitle();
  const { data, teamFor } = useLeague();
  return ({ kind, params }) => {
    switch (kind) {
      case "home":
        return "Smirnoff League";
      case "menu":
      case "teams":
      case "settings":
        return kind.charAt(0).toUpperCase() + kind.slice(1);
      case "profile":
        return "My Profile";
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
  const { nav, push, selectTab, open, back, retab } = usePhoneNav();
  const title = useScreenTitle();
  const week = useDefaultWeek();
  const isAdmin = useProfile().me?.isAdmin ?? false;
  const heading = useRef<HTMLHeadingElement>(null);
  const stack = stackOf(nav);
  const top = stack[stack.length - 1];
  const topKey = `${nav.tab}/${stack.length}/${viewKey(top.kind, top.params)}`;
  const shown = useRef(topKey);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const screens = useRef<HTMLElement>(null);
  const drawerId = useId();
  const section = sectionFor(nav.tab);
  const subPages = section ? pagesFor(section, isAdmin) : [];
  const bar = TAB_BAR.some((t) => t.tab === nav.tab) ? nav.tab : "menu";

  // The tapped link is now on a hidden screen, so hand focus to the new title.
  // A sub-tab stays put, so it keeps focus.
  useEffect(() => {
    if (shown.current === topKey) return;
    shown.current = topKey;
    if (!document.activeElement?.closest(".m-subtabs")) heading.current?.focus({ preventScroll: true });
    setScrolled((screens.current?.querySelector(".m-screen:not([hidden])")?.scrollTop ?? 0) > 24);
  }, [topKey]);

  // Scroll doesn't bubble, so this listens in the capture phase; a carousel's sideways scroll isn't the page's.
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("m-screen")) setScrolled(el.scrollTop > 24);
  };

  // A link to a page opens it in its section. Under a team, player or game
  // it stacks instead, so the header's Back still retraces the drill-down.
  const go = (screen: Screen) => {
    if (screenId(screen) === screenId(top)) return;
    const tab = pageTab(screen.kind, nav.tab);
    const drilled = SECTIONS.some((s) => s.drills?.includes(top.kind as PageKind));
    if (tab && (tab === nav.tab || !drilled)) return open(tab, screen);
    push(screen);
  };
  const navigate = (screen: Screen) => {
    const tab = pageTab(screen.kind, nav.tab);
    if (tab) open(tab, screen);
    else push(screen);
  };
  const drill = ({ kind, ...params }: DrillTarget) => go({ kind, params });
  const openMenu = () => {
    setMenuOpen(true);
    track("open", "tab:menu");
  };
  const pageFromMenu = (screen: Screen) => {
    setMenuOpen(false);
    push(screen);
  };
  const sectionFromMenu = (tab: Tab) => {
    setMenuOpen(false);
    open(tab, rootOf(tab));
  };

  return (
    <div className={glacier ? "m-app glacier" : "m-app"} data-theme={glacier ? "glacier" : undefined}>
      {glacier && <link rel="stylesheet" href={FONTS} precedence="default" />}
      <header className="m-bar" data-scrolled={(glacier && scrolled) || undefined}>
        {glacier && <Icicles className="m-bar-icicles" d={HEADER_ICICLES} />}
        {stack.length > 1 ? (
          <button type="button" className="m-back" aria-label="Back" onClick={back}>
            {glacier ? <LineIcon d={LINE_ICONS.back} size={26} /> : <BackArrowIcon width={30} height={30} />}
          </button>
        ) : (
          glacier && <Image src="/brand/crest.png" alt="" width={32} height={38} className="m-crest" />
        )}
        <h1 ref={heading} tabIndex={-1} className="m-title">
          {section && subPages.length > 1 && stack.length === 1 ? section.label : title(top)}
        </h1>
        {glacier && <GlacierTrouble />}
        <button type="button" className="m-search" aria-label="Search" onClick={() => setSearching(true)}>
          {glacier ? <LineIcon d={LINE_ICONS.search} /> : <SearchIcon width={24} height={24} />}
        </button>
        <NotificationBell onOpen={() => top.kind !== "notifications" && push({ kind: "notifications", params: {} })} />
        {glacier && (
          <button
            type="button"
            className="m-burger"
            aria-label="Menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={drawerId}
            onClick={openMenu}
          >
            <LineIcon d={LINE_ICONS.menu} />
          </button>
        )}
      </header>
      <DrillContext.Provider value={drill}>
        <Ticker xp={!glacier} />
        <ChugReelPopup />
      </DrillContext.Provider>
      {section && subPages.length > 1 && (
        <SubTabs
          label={`${section.label} pages`}
          pages={subPages}
          current={stack[0].kind as PageKind}
          onPick={(page) => open(nav.tab, pageView(page, week))}
        />
      )}
      <PushContext value={go}>
        <DrillContext.Provider value={drill}>
          <NavigateContext value={drill}>
            <main ref={screens} className="m-screens" onScrollCapture={glacier ? onScroll : undefined}>
              {TABS.flatMap((tab) =>
                (nav.stacks[tab] ?? []).map((screen, i, all) => {
                  const Body = glacier && screen.kind === "home" ? GlacierPhoneHome : bodyOf(screen.kind);
                  return (
                    // Screens under the top one stay mounted, so Back returns to
                    // them as they were left: scroll, week picked.
                    <section
                      key={`${tab}/${i + 1}/${viewKey(screen.kind, screen.params)}`}
                      className="m-screen"
                      aria-label={title(screen)}
                      hidden={tab !== nav.tab || i !== all.length - 1}
                    >
                      {/* Glacier keeps the toggle in the drawer, not on its dashboard Home. */}
                      {screen.kind === "home" && !glacier && (
                        <div className="m-theme-row">
                          <ThemeToggle />
                        </div>
                      )}
                      <WindowBoundary>
                        <TabParamContext value={retab}>
                          <Body params={screen.params} />
                        </TabParamContext>
                      </WindowBoundary>
                    </section>
                  );
                }),
              )}
            </main>
          </NavigateContext>
        </DrillContext.Provider>
      </PushContext>
      {!glacier && (
        <nav className="m-tabs" aria-label="Tabs">
          {TAB_BAR.map(({ tab, label, Icon }) => (
            <button key={tab} type="button" className="m-tab" aria-current={tab === bar ? "page" : undefined} onClick={() => selectTab(tab)}>
              <Icon width={24} height={24} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <CommandPalette
        phone
        open={searching}
        onOpenChange={setSearching}
        onGo={navigate}
      />
      {glacier && (
        <MenuDrawer id={drawerId} open={menuOpen} onClose={() => setMenuOpen(false)}>
          <DrawerNav tab={nav.tab} onSection={sectionFromMenu} onPage={pageFromMenu} />
        </MenuDrawer>
      )}
      {glacier && <Effects />}
    </div>
  );
}
