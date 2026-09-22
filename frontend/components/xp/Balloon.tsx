"use client";

import { useEffect, useId } from "react";

import { ALERT_ICONS, type AlertIconName, CloseGlyph } from "./icons";

const DISMISS_MS = 8000;

interface BalloonProps {
  title: string;
  body: string;
  icon: AlertIconName;
  onClose: () => void;
}

// The yellow tray tooltip. Keyed by the caller so each balloon gets a fresh timer.
export function Balloon({ title, body, icon, onClose }: BalloonProps) {
  const titleId = useId();
  const Icon = ALERT_ICONS[icon];

  useEffect(() => {
    const timer = setTimeout(onClose, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div role="status" aria-labelledby={titleId} className="xp-balloon">
      <div className="xp-balloon-head">
        <Icon width={16} height={16} />
        <strong id={titleId}>{title}</strong>
        <button type="button" className="xp-balloon-close" aria-label="Close notification" onClick={onClose}>
          <CloseGlyph width={10} height={10} />
        </button>
      </div>
      <p>{body}</p>
    </div>
  );
}
