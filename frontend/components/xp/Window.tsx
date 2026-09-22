import type { ReactNode } from "react";
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph } from "./icons";

interface WindowProps {
  title: string;
  icon?: ReactNode;
  controls?: boolean;
  className?: string;
  children: ReactNode;
}

export function Window({ title, icon, controls = false, className = "", children }: WindowProps) {
  return (
    <section className={`xp-window ${className}`} aria-label={title}>
      <header className="xp-titlebar">
        {icon}
        <h2 className="xp-titlebar-text">{title}</h2>
        {/* Chrome only: nothing here minimizes or closes, so these stay out of the tab order. */}
        {controls && (
          <span className="xp-titlebar-controls" aria-hidden>
            <span className="xp-control"><MinimizeGlyph /></span>
            <span className="xp-control"><MaximizeGlyph /></span>
            <span className="xp-control xp-control-close"><CloseGlyph /></span>
          </span>
        )}
      </header>
      <div className="xp-window-body">{children}</div>
    </section>
  );
}
