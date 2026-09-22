"use client";

import { useSyncExternalStore } from "react";

import { isMuted, play, setMuted, subscribeMuted } from "@/lib/sound/sound";
import { SpeakerIcon } from "./icons";

// Prerendered HTML has no storage, so it always shows the unmuted speaker.
const serverMuted = () => false;

export function SpeakerToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);

  return (
    <button
      type="button"
      className="xp-tray-button"
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Volume (muted)" : "Volume"}
      onClick={() => {
        setMuted(!muted);
        if (muted) play("ding");
      }}
    >
      <SpeakerIcon muted={muted} width={18} height={18} />
    </button>
  );
}
