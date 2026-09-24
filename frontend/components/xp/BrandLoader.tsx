"use client";

import { useId } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import "./brand-loader.css";

interface BrandLoaderProps {
  label: string;
}

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];
const SPRAY = [-160, -125, -90, -55, -20];

interface SideProps {
  ids: { outline: string; body: string };
  flip?: boolean;
}

// One arm and its bottle, drawn for the left side and mirrored for the right.
// The bottle leans 12deg in so the two caps meet at x=70 when clinked. The
// right side flips its bottle back, so both labels read the right way round.
function Side({ ids, flip }: SideProps) {
  return (
    <g className="bl-side">
      <path className="bl-outline" d="M-14 76 L52 27" />
      <path className="bl-skin-stroke" d="M-14 76 L52 27" />
      <path className="bl-sleeve-outline" d="M-22 82 L15 54.5" />
      <path className="bl-sleeve" d="M-22 82 L15 54.5" />
      <path className="bl-cuff" d="M10 58.1 L15 54.5" />
      <g transform="rotate(12 54 50)">
        <g transform={flip ? "matrix(-1 0 0 1 108 0)" : undefined}>
          {/* The art is 72x256; this keeps its shape at the old bottle's height. */}
          <image
            className="bl-bottle"
            href="/brand/ice-bottle-256.png"
            x="43.3"
            y="10"
            width="21.4"
            height="76"
            filter={`url(#${ids.outline})`}
          />
        </g>
        <g className="bl-frost" clipPath={`url(#${ids.body})`}>
          <rect className="bl-frost-fill" x="43" y="38" width="22" height="48" />
          <path className="bl-sheen" d="M40 60 L52 36 H57 L45 60 Z M46 86 L60 58 H62 L48 86 Z" />
        </g>
        <rect className="bl-fist" x="46" y="20" width="16" height="13" rx="5" />
        <path className="bl-knuckles" d="M57 24.5 H62 M57 28.5 H62" />
        <rect className="bl-thumb" x="45" y="17" width="10" height="6" rx="3" />
      </g>
    </g>
  );
}

// Styled only through .brand-loader classes, so the data-theme the pre-hydration
// script puts on <html> restyles it before React runs.
export function BrandLoader({ label }: BrandLoaderProps) {
  const still = useReducedMotion();
  const id = useId();
  const ids = { outline: `${id}-outline`, body: `${id}-body` };
  return (
    <div className="brand-loader">
      <svg
        className={`brand-loader-art ${still ? "brand-loader-still" : "brand-loader-cheer"}`}
        viewBox="0 -6 140 100"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id={ids.outline} x="-20%" y="-10%" width="140%" height="120%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="grown" />
            <feFlood className="bl-ink" />
            <feComposite in2="grown" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={ids.body}>
            <rect x="44.6" y="39" width="18.8" height="45" rx="3" />
          </clipPath>
        </defs>
        <Side ids={ids} />
        <g className="bl-right" transform="matrix(-1 0 0 1 140 0)">
          <Side ids={ids} flip />
        </g>
        <g transform="translate(70 11)">
          <g className="bl-burst">
            <circle className="bl-ring" r="9" />
            {SPARKS.map((a) => (
              <path key={a} className="bl-spark" d="M0 -7 V-12" transform={`rotate(${a})`} />
            ))}
            {SPRAY.map((a) => (
              <g key={a} transform={`rotate(${a}) translate(15 0)`}>
                <path className="bl-star" d="M0 -3.5 L0.9 -0.9 L3.5 0 L0.9 0.9 L0 3.5 L-0.9 0.9 L-3.5 0 L-0.9 -0.9 Z" />
                <path className="bl-crystal" d="M-3.5 0 H3.5 M-1.75 -3 L1.75 3 M-1.75 3 L1.75 -3" />
              </g>
            ))}
          </g>
        </g>
      </svg>
      <p role="status" className="brand-loader-label">
        {label}
      </p>
    </div>
  );
}
