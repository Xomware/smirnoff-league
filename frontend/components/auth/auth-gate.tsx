"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Landing } from "@/components/landing/landing";
import { ProfileGate } from "@/components/onboarding/profile-gate";
import { startTracking } from "@/lib/activity/tracker";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { authConfigured, CALLBACK_PATH } from "@/lib/auth/amplify";
import { useAuth } from "@/lib/auth/use-auth";
import { ProfileProvider } from "@/lib/profile/use-profile";

// Mounted only in the signed-in branch, so the landing is never tracked.
function ActivityTracking() {
  useEffect(startTracking, []);
  return null;
}

interface AuthGateProps {
  children: ReactNode;
}

/**
 * THIS IS UX, NOT SECURITY. The site is a static export: anyone can read the
 * bundle and render any page's code without signing in. The gate exists so
 * signed-out visitors see the landing instead of empty pages. Anything that
 * must stay private (the ledger, videos, write-ups) is served only by
 * Cognito-authorized endpoints or presigned URLs, never from the bundle.
 *
 * While auth settles this renders the landing, not a spinner. A signed-out
 * visitor is the common cold load, and the prerendered HTML then never
 * contains a gated page.
 */
export function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const { status, signInWithGoogle } = useAuth();

  // The callback must render signed out: it is where the sign-in completes.
  if (pathname.replace(/\/$/, "") === CALLBACK_PATH) return children;
  if (status === "signedIn") {
    return (
      <ProfileProvider>
        <ActivityTracking />
        <AlertsProvider>
          <ProfileGate>{children}</ProfileGate>
        </AlertsProvider>
      </ProfileProvider>
    );
  }
  return <Landing onSignIn={authConfigured ? signInWithGoogle : undefined} />;
}
