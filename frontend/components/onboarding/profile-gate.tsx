"use client";

import type { ReactNode } from "react";

import { SignInGreeting } from "@/components/xp/SignInGreeting";
import { Window } from "@/components/xp/Window";
import { useProfile } from "@/lib/profile/use-profile";
import { OnboardingWizard } from "./onboarding-wizard";

interface ProfileGateProps {
  children: ReactNode;
  shell?: ReactNode;
}

// Holds the app back until the signed-in user has a profile, and hosts the
// wizard again when they edit it from the Start menu.
export function ProfileGate({ children, shell }: ProfileGateProps) {
  const { me, error, refresh, editing, setEditing } = useProfile();

  if (error) {
    return (
      <main className="xp-page min-h-screen justify-center">
        <Window title="Smirnoff League">
          <p role="alert" className="mb-3">
            Could not load your profile ({error}).
          </p>
          <button type="button" className="xp-button" onClick={() => void refresh()}>
            Try again
          </button>
        </Window>
      </main>
    );
  }
  if (!me) {
    return (
      <main className="xp-page min-h-screen justify-center">
        <p role="status" className="xp-note">
          Loading your profile...
        </p>
      </main>
    );
  }
  if (!me.profile || editing) {
    return (
      <OnboardingWizard
        initial={me.profile}
        onDone={async () => {
          await refresh();
          setEditing(false);
        }}
        onCancel={me.profile ? () => setEditing(false) : undefined}
      />
    );
  }
  return (
    <>
      {children}
      {shell}
      <SignInGreeting />
    </>
  );
}
