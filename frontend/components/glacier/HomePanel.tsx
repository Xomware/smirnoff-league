"use client";

import { type HTMLAttributes, type ReactNode, useContext } from "react";

import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { Crystal, Icicles, PANEL_ICICLES } from "./Frost";

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "id" | "title" | "className" | "children"> {
  id: string;
  label: string;
  title?: string;
  all?: DrillTarget;
  more?: string;
  aside?: ReactNode;
  className: string;
  children: ReactNode;
}

export function Panel({ id, label, title = label, all, more = "See all", aside, className, children, ...rest }: PanelProps) {
  const open = useContext(DrillContext);
  return (
    <section id={id} aria-label={label} className={`glacier-panel gh-panel ${className}`} {...rest}>
      <Icicles className="glacier-icicles" d={PANEL_ICICLES} />
      <Crystal />
      <div className="gh-head">
        <h2 tabIndex={-1}>{title}</h2>
        {aside}
        {all && (
          <button type="button" className="gh-link" aria-label={`${more}: ${label}`} onClick={() => open(all)}>
            {more}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
