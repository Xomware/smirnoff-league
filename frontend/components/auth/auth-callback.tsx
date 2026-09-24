"use client";

import { Hub } from "aws-amplify/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLoader } from "@/components/xp/BrandLoader";
import { takeNextPath } from "@/lib/auth/next-path";
import { useAuth } from "@/lib/auth/use-auth";

/**
 * Waits for Amplify to finish the Google sign-in, then leaves.
 *
 * Amplify detects `?code=` on load and exchanges it itself, so nothing here
 * parses the URL. A hosted-UI round trip can fail without the browser ever
 * reporting it (revoked consent, clock skew, a code already redeemed), so
 * after a timeout this says so instead of spinning forever.
 */
const TIMEOUT_MS = 8000;

export function AuthCallback() {
  const router = useRouter();
  const { status, refresh } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void refresh();
      if (payload.event === "signInWithRedirect_failure") setFailed(true);
    });
    const timer = setTimeout(() => setFailed(true), TIMEOUT_MS);
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (status !== "signedIn") return;
    // replace(), not push(): the callback URL holds a spent authorization
    // code, and Back would land on a request that can never succeed again.
    router.replace(takeNextPath());
  }, [status, router]);

  const loading = !failed || status === "signedIn";
  return (
    <main
      className={`flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-100 p-8 text-center text-stone-900 ${loading ? "brand-loader-page" : ""}`}
    >
      {!loading ? (
        <>
          <h1 className="text-xl font-semibold">That sign-in did not finish</h1>
          <p className="max-w-sm text-stone-700">
            The link may have expired, or the window was left open too long. Try again.
          </p>
          <Link
            href="/"
            className="border border-stone-500 bg-stone-50 px-6 py-2 font-semibold hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <BrandLoader label="Signing you in..." />
      )}
    </main>
  );
}
