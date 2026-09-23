"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

import { authConfigured } from "./amplify";
import { rememberNextPath } from "./next-path";

export interface AuthState {
  status: "loading" | "signedIn" | "signedOut" | "unconfigured";
  email: string | null;
}

const SIGNED_OUT: AuthState = { status: "signedOut", email: null };

// Returns state rather than setting it, so the effect below only calls
// setState after an await and never cascades a render mid-mount.
async function resolveAuth(): Promise<AuthState> {
  if (!authConfigured) return { status: "unconfigured", email: null };
  try {
    await getCurrentUser();
    const session = await fetchAuthSession();
    const email = session.tokens?.idToken?.payload.email;
    return { status: "signedIn", email: typeof email === "string" ? email : null };
  } catch {
    // getCurrentUser throws when there is no session; that is just signed out.
    return SIGNED_OUT;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => ({
    status: authConfigured ? "loading" : "unconfigured",
    email: null,
  }));

  const refresh = useCallback(async () => {
    setState(await resolveAuth());
  }, []);

  useEffect(() => {
    if (!authConfigured) return;
    let cancelled = false;
    const update = async () => {
      const next = await resolveAuth();
      // A sign-out during the initial read must not be overwritten by it.
      if (!cancelled) setState(next);
    };
    void update();

    // The Google sign-in completes outside React: Amplify swaps the code for
    // tokens on load and announces it here. Without this, mounted components
    // keep their stale signed-out state after a successful round trip.
    const stop = Hub.listen("auth", ({ payload }) => {
      if (
        payload.event === "signInWithRedirect" ||
        payload.event === "signedIn" ||
        payload.event === "signedOut" ||
        payload.event === "tokenRefresh"
      ) {
        void update();
      }
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return {
    ...state,
    refresh,
    signOut: async () => {
      await amplifySignOut();
      await refresh();
    },
    signInWithGoogle: async () => {
      rememberNextPath(window.location.pathname + window.location.search);
      await signInWithRedirect({ provider: { custom: "GoogleSmirnoff" } });
    },
  };
}
