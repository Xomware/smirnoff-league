"use client";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import "./brand-loader.css";

interface BrandLoaderProps {
  label: string;
  theme?: "xp" | "glacier";
}

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];
const SPRAY = [-160, -125, -90, -55, -20];

// One arm and its bottle, drawn for the left side and mirrored for the right.
// The bottle leans 12deg in so the two caps meet at x=70 when clinked.
function Side() {
  return (
    <g className="bl-side">
      <path className="bl-outline" d="M-14 76 L52 27" />
      <path className="bl-skin-stroke" d="M-14 76 L52 27" />
      <path className="bl-sleeve-outline" d="M-22 82 L15 54.5" />
      <path className="bl-sleeve" d="M-22 82 L15 54.5" />
      <path className="bl-cuff" d="M10 58.1 L15 54.5" />
      <g transform="rotate(12 54 50)">
        <path className="bl-glass" d="M43 44 Q43 36 49 32 L49 16 L59 16 L59 32 Q65 36 65 44 L65 82 Q65 86 61 86 L47 86 Q43 86 43 82 Z" />
        <path className="bl-shine" d="M47.5 46 L47.5 80" />
        <rect className="bl-band" x="43" y="50" width="22" height="8" />
        <rect className="bl-label" x="45" y="59" width="18" height="13" />
        <rect className="bl-label-text" x="48" y="63.5" width="12" height="4" />
        <rect className="bl-cap" x="48" y="10" width="12" height="7" rx="1" />
        <rect className="bl-fist" x="46" y="20" width="16" height="13" rx="5" />
        <path className="bl-knuckles" d="M57 24.5 H62 M57 28.5 H62" />
        <rect className="bl-thumb" x="45" y="17" width="10" height="6" rx="3" />
      </g>
    </g>
  );
}

// Styled only through .brand-loader classes, so an ancestor data-theme can restyle it.
export function BrandLoader({ label, theme = "xp" }: BrandLoaderProps) {
  const still = useReducedMotion();
  return (
    <div className="brand-loader" data-theme={theme === "glacier" ? "glacier" : undefined}>
      <svg
        className={`brand-loader-art ${still ? "brand-loader-still" : "brand-loader-cheer"}`}
        viewBox="0 -6 140 100"
        aria-hidden="true"
        focusable="false"
      >
        <Side />
        <g className="bl-right" transform="matrix(-1 0 0 1 140 0)">
          <Side />
        </g>
        <g transform="translate(70 11)">
          <g className="bl-burst">
            {SPARKS.map((a) => (
              <path key={a} className="bl-spark" d="M0 -6 V-11" transform={`rotate(${a})`} />
            ))}
            {SPRAY.map((a) => (
              <g key={a} transform={`rotate(${a}) translate(14 0)`}>
                <circle className="bl-drop" r="2" />
                <path className="bl-crystal" d="M-3 0 H3 M-1.5 -2.6 L1.5 2.6 M-1.5 2.6 L1.5 -2.6" />
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
