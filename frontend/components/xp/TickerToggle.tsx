"use client";

import { setTickerHidden, useTickerHidden } from "@/lib/ticker/prefs";
import { TickerIcon } from "./icons";

export function TickerToggle() {
  const hidden = useTickerHidden();
  return (
    <button
      type="button"
      className="xp-tray-button"
      aria-label={hidden ? "Show the league ticker" : "Hide the league ticker"}
      title={hidden ? "Ticker (hidden)" : "Ticker"}
      onClick={() => setTickerHidden(!hidden)}
    >
      <TickerIcon off={hidden} width={18} height={18} />
    </button>
  );
}
