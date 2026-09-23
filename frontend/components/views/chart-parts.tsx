"use client";

import type { ReactNode } from "react";

import { PHONE, useMediaQuery } from "@/lib/use-media-query";

// Every chart draws into a 360-wide viewBox. A phone draws that at about 1:1,
// so there the text is bigger and the rows make room for it.
export const WIDTH = 360;
export const AXIS = "stroke-(--xp-face-shadow)";

// The top three, in rank order. Dashes keep them apart without relying on colour.
export const HIGHLIGHTS = [
  { stroke: "stroke-(--smirnoff-red)", fill: "fill-(--smirnoff-red)", dash: undefined },
  { stroke: "stroke-(--ice-deep)", fill: "fill-(--ice-deep)", dash: "6 3" },
  { stroke: "stroke-(--xp-hill-dark)", fill: "fill-(--xp-hill-dark)", dash: "2 3" },
];

export function useChartText() {
  const phone = useMediaQuery(PHONE);
  return {
    phone,
    text: `fill-(--xp-text) ${phone ? "text-[13px]" : "text-[11px]"}`,
    small: `fill-(--xp-text) ${phone ? "text-[11px]" : "text-[9px]"}`,
  };
}

export function niceTicks(max: number, count = 4) {
  const step = Math.max(1, Math.ceil(max / count));
  return Array.from({ length: Math.ceil(Math.max(max, 1) / step) + 1 }, (_, i) => i * step);
}

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function Legend({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
      {children}
    </ul>
  );
}

export function Swatch({ className, dash, width = 2.5 }: { className: string; dash?: string; width?: number }) {
  return (
    <svg width="22" height="10" aria-hidden className="shrink-0">
      <line x1="1" x2="21" y1="5" y2="5" strokeWidth={width} strokeDasharray={dash} className={className} />
    </svg>
  );
}
