"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { WindowKind } from "@/lib/desktop/registry";

interface OpenRedirectProps {
  kind: WindowKind;
}

// The old per-page routes stay in the static export so existing links still
// land, then hand off to the desktop with that window open.
export function OpenRedirect({ kind }: OpenRedirectProps) {
  const router = useRouter();
  useEffect(() => router.replace(`/?open=${kind}`), [router, kind]);
  return null;
}
