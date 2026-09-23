"use client";

import { useEffect } from "react";

// On body rather than .xp-desktop: the taskbar and the dialogs portaled to body
// sit outside it.
export function XpCursor() {
  useEffect(() => {
    const { classList } = document.body;
    const press = () => classList.add("xp-cursor-pressed");
    const release = () => classList.remove("xp-cursor-pressed");
    classList.add("xp-cursor");
    document.addEventListener("pointerdown", press);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      classList.remove("xp-cursor", "xp-cursor-pressed");
    };
  }, []);
  return null;
}
