"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

interface MenuDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Stays mounted while closed, inert, so it can slide out as well as in.
export function MenuDrawer({ id, open, onClose, children }: MenuDrawerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    // A row that opened a screen moves focus to its title after this runs.
    return () => opener?.focus();
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  return (
    <div className="gp-drawer" data-open={open} inert={!open}>
      <div className="gp-drawer-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Menu" className="gp-drawer-panel" onKeyDown={onKeyDown}>
        <div className="gp-drawer-head">
          <h2>Menu</h2>
          <button type="button" className="gp-drawer-close" aria-label="Close menu" onClick={onClose}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="gp-drawer-body">{children}</div>
      </div>
    </div>
  );
}
