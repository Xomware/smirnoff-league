"use client";

import { DrillLink } from "@/components/views/drill-link";
import { CalendarIcon, ControlPanelIcon, IceBottleIcon, ProfileIcon, ToiletIcon } from "@/components/xp/icons";
import type { WindowParams } from "@/lib/desktop/windows";
import { useLedger } from "@/lib/ices/use-ledger";
import { useProfile } from "@/lib/profile/use-profile";
import { IcesPanel } from "./IcesPanel";
import { ToiletPanel } from "./ToiletPanel";
import { UsersPanel } from "./UsersPanel";
import { WeekRulesPanel } from "./WeekRulesPanel";

import "./control-panel.css";

export const ADMIN_PANELS = ["ices", "rules", "toilet", "users"] as const;
export type AdminPanel = (typeof ADMIN_PANELS)[number];

export const CATEGORIES = {
  ices: { label: "Ices", blurb: "Add, void and complete ices, and log chug times", Icon: IceBottleIcon },
  rules: { label: "Week Rules", blurb: "Switch ice rules per week, pick who counts for lowest, finalize", Icon: CalendarIcon },
  toilet: { label: "Toilet Bowl", blurb: "Choose the two seeds that skip round one", Icon: ToiletIcon },
  users: { label: "Users", blurb: "Who signs in, from what device, and where they go", Icon: ProfileIcon },
} as const;

const isPanel = (value: unknown): value is AdminPanel => ADMIN_PANELS.includes(value as AdminPanel);

function Categories() {
  return (
    <>
      <h3 className="cp-heading">Pick a category</h3>
      <ul className="cp-categories">
        {ADMIN_PANELS.map((panel) => {
          const { label, blurb, Icon } = CATEGORIES[panel];
          return (
            <li key={panel}>
              <DrillLink to={{ kind: "admin", panel }}>
                <span className="cp-category">
                  <span className="cp-category-icon">
                    <Icon width={40} height={40} />
                  </span>
                  <span>
                    <span className="cp-category-label">{label}</span>
                    <span className="cp-category-blurb">{blurb}</span>
                  </span>
                </span>
              </DrillLink>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function LedgerPanel({ panel }: { panel: Exclude<AdminPanel, "users"> }) {
  const state = useLedger();
  if (state.status === "loading") return <p role="status">Loading the ledger...</p>;
  if (state.status === "error") return <p role="alert">Could not load the ledger ({state.message}). Close and reopen to try again.</p>;
  if (panel === "ices") return <IcesPanel ledger={state.ledger} />;
  if (panel === "rules") return <WeekRulesPanel ledger={state.ledger} />;
  return <ToiletPanel ledger={state.ledger} />;
}

function Panel({ panel }: { panel: AdminPanel }) {
  const { label, Icon } = CATEGORIES[panel];
  return (
    <>
      <h3 className="cp-heading">
        <Icon width={24} height={24} />
        {label}
      </h3>
      {panel === "users" ? <UsersPanel /> : <LedgerPanel panel={panel} />}
    </>
  );
}

// The server checks the admin list on every call; this gate only keeps the UI
// out of reach of everyone else.
export function ControlPanelWindow({ params }: { params: WindowParams }) {
  const { me, error } = useProfile();
  if (error) return <p role="alert">Could not check your account ({error}).</p>;
  if (!me) return <p role="status">Checking your account...</p>;
  if (!me.isAdmin) return <p role="alert">The Control Panel is only for league admins.</p>;

  const panel = isPanel(params.panel) ? params.panel : null;
  return (
    <div className="cp">
      <nav className="cp-side" aria-label="Control Panel categories">
        <div className="cp-side-box">
          <h3 className="cp-side-title">Control Panel</h3>
          {panel ? (
            <DrillLink to={{ kind: "admin" }}>
              <span className="cp-side-link">
                <ControlPanelIcon width={16} height={16} />
                Control Panel Home
              </span>
            </DrillLink>
          ) : (
            <p>Every change saves at once and shows up for the league on their next refresh.</p>
          )}
        </div>
        {panel && (
          <div className="cp-side-box">
            <h3 className="cp-side-title">See Also</h3>
            <ul>
              {ADMIN_PANELS.filter((p) => p !== panel).map((p) => {
                const { label, Icon } = CATEGORIES[p];
                return (
                  <li key={p}>
                    <DrillLink to={{ kind: "admin", panel: p }}>
                      <span className="cp-side-link">
                        <Icon width={16} height={16} />
                        {label}
                      </span>
                    </DrillLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
      <div className="cp-main">{panel ? <Panel panel={panel} /> : <Categories />}</div>
    </div>
  );
}
