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
// Set while a choice has not reached the profile, so the stale saved theme
// doesn't win on the next load and undo it (#185).
const UNSAVED_KEY = "smirnoff.theme.unsaved";

function markUnsaved(on: boolean) {
  try {
    if (on) localStorage.setItem(UNSAVED_KEY, "1");
    else localStorage.removeItem(UNSAVED_KEY);
  } catch {
    // Without storage the choice only lives for this visit anyway.
  }
}

function isUnsaved() {
  try {
    return localStorage.getItem(UNSAVED_KEY) === "1";
  } catch {
    return false;
  }
}

function save(theme: Theme) {
  markUnsaved(true);
  return updateMe({ theme }).then(() => markUnsaved(false));
}

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
    const html = document.documentElement;
    const color = chromeColor(theme, phone);
    html.dataset.theme = theme;
    html.style.backgroundColor = color;
    themeColorMeta().content = color;
  }, [theme, phone]);

  // Keyed on the saved value, not the profile object, which changes on every
  // notifications-seen mark and would otherwise undo a switch made since load.
  useEffect(() => {
    if (!onboarded) return;
    const local = read();
    if (saved && !(local && isUnsaved())) return write(saved);
    // Left unsaved on failure, so the next load tries again.
    if (local && local !== saved) save(local).catch(() => {});
  }, [onboarded, saved]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return;
      setSwitching(true);
      // Saved from inside apply: the transition drops a switch made while one is
      // running, and a fast failure must not roll back before the swap lands.
      void runThemeTransition(next, () => {
        write(next);
        if (!onboarded) return;
        // A failed save keeps the choice on screen; the next load retries it.
        save(next).catch(() => {
          notify({
            title: "Theme not synced",
            body: "Your theme is set here but didn't reach your profile. It will sync next time you open the site.",
            icon: "error",
          });
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

// Safari paints its toolbars and the overscroll bounce from the page background
// and theme-color, never from the app's own boxes, so both carry the colour
// under the toolbar: the phone page, or the XP desktop's sky (#225).
const CHROME = { glacier: "#0f2b45", xp: "#2b64c9", xpPhone: "#f3f0e1" };
const chromeColor = (theme: Theme, phone: boolean) => (theme === "glacier" ? CHROME.glacier : phone ? CHROME.xpPhone : CHROME.xp);

function themeColorMeta() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  return meta;
}

/** Runs before hydration so the first paint (the loader) is already in the right theme. */
export const THEME_SCRIPT = `var t,p=matchMedia(${JSON.stringify(PHONE)}).matches,h=document.documentElement,m=document.createElement("meta");try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="xp"&&t!=="glacier")t=p?"glacier":"xp";h.dataset.theme=t;m.name="theme-color";m.content=t==="glacier"?"${CHROME.glacier}":p?"${CHROME.xpPhone}":"${CHROME.xp}";h.style.backgroundColor=m.content;document.head.append(m)`;
