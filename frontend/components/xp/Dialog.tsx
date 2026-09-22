"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";

import { ALERT_ICONS } from "./icons";

export type AlertKind = "info" | "warning" | "error";

interface DialogProps {
  kind: AlertKind;
  title: string;
  body: string;
  buttons: string[];
  onClose: (button: string | null) => void;
}

// A modal XP message box. Escape resolves with null, like closing the window.
export function Dialog({ kind, title, body, buttons, onClose }: DialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const box = useRef<HTMLDivElement>(null);
  const Icon = ALERT_ICONS[kind];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector("button")?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose(null);
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll("button") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  return (
    // Clicking the backdrop must not pull focus out of the box, or Escape and the trap stop working.
    <div className="xp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div
        ref={box}
        role={kind === "info" ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="xp-dialog xp-message-box"
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="xp-dialog-title">
          {title}
        </h2>
        <div className="xp-message-body">
          <Icon width={32} height={32} className="flex-none" />
          <p id={bodyId}>{body}</p>
        </div>
        <div className="xp-message-buttons">
          {buttons.map((label) => (
            <button key={label} type="button" className="xp-button" onClick={() => onClose(label)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
