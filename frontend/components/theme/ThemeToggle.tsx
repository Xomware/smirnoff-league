"use client";

import type { ComponentType, SVGProps } from "react";

import { type Theme, useTheme } from "@/lib/theme/theme";

import "./theme-toggle.css";

type GlyphProps = SVGProps<SVGSVGElement>;

// A 16px pixel-art XP window: blue title bar, red close box, cream body.
export function XpWindowGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} shapeRendering="crispEdges" aria-hidden focusable="false" {...props}>
      <rect x="1" y="2" width="14" height="12" fill="#0831d9" />
      <rect x="2" y="3" width="12" height="3" fill="#3d95ff" />
      <rect x="11" y="3" width="3" height="3" fill="#e0533a" />
      <rect x="2" y="7" width="12" height="6" fill="#fbf8ec" />
      <rect x="3" y="8" width="5" height="1" fill="#aca899" />
      <rect x="3" y="10" width="7" height="1" fill="#aca899" />
    </svg>
  );
}

export function SnowflakeGlyph(props: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
      <path d="M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5M3.6 10.4l3.7-1.3-.7-3.9M20.4 13.6l-3.7 1.3.7 3.9M3.6 13.6l3.7 1.3-.7 3.9M20.4 10.4l-3.7-1.3.7-3.9" />
    </svg>
  );
}

const OPTIONS: { theme: Theme; label: string; Glyph: ComponentType<GlyphProps> }[] = [
  { theme: "xp", label: "Classic XP", Glyph: XpWindowGlyph },
  { theme: "glacier", label: "Glacier", Glyph: SnowflakeGlyph },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="group" aria-label="Theme" className="theme-toggle">
      {OPTIONS.map(({ theme: option, label, Glyph }) => (
        <button key={option} type="button" aria-pressed={theme === option} onClick={() => setTheme(option)}>
          <Glyph />
          {label}
        </button>
      ))}
    </div>
  );
}
