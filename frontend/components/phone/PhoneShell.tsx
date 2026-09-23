"use client";

import { useEffect, useId, useRef, useState } from "react";

import { WindowBoundary } from "@/components/desktop/DesktopWindow";
import { DrillContext, type DrillTarget, NavigateContext } from "@/components/views/drill-link";
import { BackArrowIcon, HomeIcon, IceBottleIcon, ScoresIcon, StandingsIcon, StarIcon } from "@/components/xp/icons";
import { useAuth } from "@/lib/auth/use-auth";
import { REGISTRY, useWindowTitle } from "@/lib/desktop/registry";
import { windowId } from "@/lib/desktop/windows";
import { stackOf, type Tab, TABS } from "@/lib/phone/nav";
import { usePhoneNav } from "@/lib/phone/use-phone-nav";
import { useProfile } from "@/lib/profile/use-profile";
import { NotificationBell } from "@/components/xp/NotificationBell";
import { StartSheet } from "./StartSheet";

import "./phone.css";

const TAB_BAR: Record<Tab, { label: string; Icon: typeof HomeIcon }> = {
  home: { label: "Home", Icon: HomeIcon },
  scores: { label: "Scores", Icon: ScoresIcon },
  ices: { label: "Ices", Icon: IceBottleIcon },
  standings: { label: "Standings", Icon: StandingsIcon },
  "my-team": { label: "My Team", Icon: StarIcon },
};

export function PhoneShell() {
  const { nav, push, selectTab, back } = usePhoneNav();
  const [sheet, setSheet] = useState(false);
  const { signOut } = useAuth();
  const { me, setEditing } = useProfile();
  const windowTitle = useWindowTitle();
  const sheetId = useId();
  const start = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stack = stackOf(nav);
  const view = stack[stack.length - 1];
  const topKey = `${nav.tab}/${stack.length}/${windowId(view.kind, view.params)}`;
  const { Icon } = REGISTRY[view.kind];
  const shown = useRef(topKey);

  // The tapped link is now on a hidden screen, so hand focus to the new title.
  useEffect(() => {
    if (shown.current === topKey) return;
    shown.current = topKey;
    heading.current?.focus({ preventScroll: true });
  }, [topKey]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSheet(false);
      start.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet]);

  const drill = ({ kind, ...params }: DrillTarget) => push({ kind, params });

  return (
    <div className="phone">
      <header className="phone-bar">
        {stack.length > 1 ? (
          <button type="button" className="phone-back" aria-label="Back" onClick={back}>
            <BackArrowIcon width={28} height={28} />
          </button>
        ) : (
          <Icon width={24} height={24} className="phone-bar-icon" />
        )}
        <h1 ref={heading} tabIndex={-1} className="phone-title">
          {windowTitle(view)}
        </h1>
        <NotificationBell onOpen={() => view.kind !== "notifications" && push({ kind: "notifications", params: {} })} />
      </header>
      <DrillContext.Provider value={drill}>
        <NavigateContext value={drill}>
          <div className="phone-screens">
            {TABS.flatMap((tab) =>
              (nav.stacks[tab] ?? []).map((v, i, all) => {
                const { component: Body } = REGISTRY[v.kind];
                return (
                  // Screens under the top one stay mounted, so Back returns to
                  // them as they were left: scroll, week picked, matchup open.
                  <section
                    key={`${tab}/${i + 1}/${windowId(v.kind, v.params)}`}
                    className="phone-screen"
                    hidden={tab !== nav.tab || i !== all.length - 1}
                  >
                    <WindowBoundary>
                      <Body params={v.params} />
                    </WindowBoundary>
                  </section>
                );
              }),
            )}
          </div>
        </NavigateContext>
      </DrillContext.Provider>
      {sheet && (
        <>
          <div className="phone-sheet-backdrop" aria-hidden onClick={() => setSheet(false)} />
          <StartSheet
            id={sheetId}
            name={me?.profile?.name ?? "Smirnoff League"}
            onOpen={(kind) => {
              setSheet(false);
              push({ kind, params: {} });
            }}
            onEditProfile={() => {
              setSheet(false);
              setEditing(true);
            }}
            onSignOut={() => void signOut()}
          />
        </>
      )}
      <nav className="phone-tabs" aria-label="Tabs">
        <button
          ref={start}
          type="button"
          className="xp-start phone-start"
          aria-expanded={sheet}
          aria-controls={sheet ? sheetId : undefined}
          onClick={() => setSheet((s) => !s)}
        >
          <IceBottleIcon width={20} height={20} />
          start
        </button>
        <ul className="phone-tab-list">
          {TABS.map((tab) => {
            const { label, Icon: TabIcon } = TAB_BAR[tab];
            return (
              <li key={tab}>
                <button
                  type="button"
                  className="phone-tab"
                  aria-current={tab === nav.tab ? "page" : undefined}
                  onClick={() => {
                    setSheet(false);
                    selectTab(tab);
                  }}
                >
                  <TabIcon width={20} height={20} />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
