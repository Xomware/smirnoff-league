"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { FONTS } from "@/components/glacier/Frost";
import { runThemeTransition } from "@/components/theme/transition";
import { useAlerts } from "@/lib/alerts/alerts";
import { updateMe } from "@/lib/api/users";
import { useProfile } from "@/lib/profile/use-profile";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";

// Its tokens are what the loaders read before any Glacier view has loaded.
import "@/components/glacier/glacier.css";

export type Theme = "xp" | "glacier";

export const THEME_KEY = "smirnoff.theme";

const isTheme = (v: unknown): v is Theme => v === "xp" || v === "glacier";

// Used only when storage throws (blocked cookies, some private modes), so the
// choice still holds for this visit.
let unstored: Theme | null = null;
const listeners = new Set<() => void>();

function read(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return unstored;
  }
}

// Only an explicit choice is stored; null clears it back to the device default.
function write(theme: Theme | null) {
  unstored = theme;
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // `unstored` carries it instead.
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The prerendered HTML is always XP; the stored theme takes over after hydration.
const serverTheme = () => null;

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** True while a switch plays; another switch then would be dropped. */
  switching: boolean;
}

const ThemeContext = createContext<ThemeState>({ theme: "xp", setTheme: () => {}, switching: false });

/**
 * The profile's theme when signed in, else this browser's, else the device
 * default: Glacier on a phone, XP on a desktop. Mount it inside ProfileProvider
 * when signed in; outside it there is no profile and the choice stays in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const phone = useMediaQuery(PHONE);
  const theme = useSyncExternalStore(subscribe, read, serverTheme) ?? (phone ? "glacier" : "xp");
  const [switching, setSwitching] = useState(false);
  const { me } = useProfile();
  const { notify } = useAlerts();
  const onboarded = Boolean(me?.profile);
  const saved = me?.profile?.theme;

  // Hydration drops an attribute the inline script put on <html> before it, so it is set again here.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Keyed on the saved value, not the profile object, which changes on every
  // notifications-seen mark and would otherwise undo a switch made since load.
  useEffect(() => {
    if (!onboarded) return;
    if (saved) return write(saved);
    const local = read();
    // Left unsaved on failure, so the next load tries again.
    if (local) updateMe({ theme: local }).catch(() => {});
  }, [onboarded, saved]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return;
      const before = read();
      setSwitching(true);
      // Saved from inside apply: the transition drops a switch made while one is
      // running, and a fast failure must not roll back before the swap lands.
      void runThemeTransition(next, () => {
        write(next);
        if (!onboarded) return;
        updateMe({ theme: next }).catch(() => {
          write(before);
          notify({ title: "Theme not saved", body: "Couldn't save your theme. Try again in a moment.", icon: "error" });
        });
      }).finally(() => setSwitching(false));
    },
    [theme, onboarded, notify],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, switching }}>
      {theme === "glacier" && <link rel="stylesheet" href={FONTS} precedence="default" />}
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/** Runs before hydration so the first paint (the loader) is already in the right theme. */
export const THEME_SCRIPT = `var t;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="xp"&&t!=="glacier")t=matchMedia(${JSON.stringify(PHONE)}).matches?"glacier":"xp";document.documentElement.dataset.theme=t`;
