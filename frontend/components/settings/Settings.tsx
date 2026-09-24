"use client";

import { type ReactNode, useContext, useEffect, useId, useSyncExternalStore } from "react";

import { DEFAULT_EMAIL, EmailAlerts } from "@/components/onboarding/email-alerts";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DrillContext } from "@/components/views/drill-link";
import { useProfile } from "@/lib/profile/use-profile";
import { isMuted, play, setMuted, subscribeMuted } from "@/lib/sound/sound";
import { setTickerHidden, useTickerHidden } from "@/lib/ticker/prefs";

import "@/components/onboarding/onboarding.css";
import "./settings.css";

interface GroupProps {
  title: string;
  children: ReactNode;
}

function SettingsGroup({ title, children }: GroupProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="settings-group">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

const serverMuted = () => false;

export function Settings() {
  const { me, error, refresh } = useProfile();
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);
  const open = useContext(DrillContext);
  const tickerHidden = useTickerHidden();

  // Email alerts save as they are clicked, so the profile is stale once we leave.
  useEffect(() => () => void refresh(), [refresh]);

  if (error) return <p role="alert">Could not load your account ({error}).</p>;
  if (!me?.profile) return <p role="status">Loading your settings...</p>;

  return (
    <div className="settings">
      <SettingsGroup title="Email alerts">
        <EmailAlerts address={me.email} initial={me.profile.email ?? DEFAULT_EMAIL} />
      </SettingsGroup>
      <SettingsGroup title="Appearance">
        <ThemeToggle />
      </SettingsGroup>
      <SettingsGroup title="Sound">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={!muted}
            onChange={() => {
              setMuted(!muted);
              if (muted) play("ding");
            }}
          />
          Play sounds
        </label>
      </SettingsGroup>
      <SettingsGroup title="Ticker">
        <label className="settings-check">
          <input type="checkbox" checked={!tickerHidden} onChange={() => setTickerHidden(!tickerHidden)} />
          Show the league ticker
        </label>
      </SettingsGroup>
      {me.isAdmin && (
        <SettingsGroup title="League admin">
          <p>Ices, week rules, the toilet bowl seeds and who signs in.</p>
          <button type="button" className="xp-button" onClick={() => open({ kind: "admin" })}>
            Open the Control Panel
          </button>
        </SettingsGroup>
      )}
    </div>
  );
}
