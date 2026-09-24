import { useEffect } from "react";

// Drawers that stay mounted while closed are inert, so only a live modal counts.
export const modalOpen = () => [...document.querySelectorAll('[aria-modal="true"]')].some((m) => !m.closest("[inert]"));

// The phone page is the document, so a touch on an open drawer, sheet or dialog
// would scroll the page under it. Hiding the root's overflow stops that and
// keeps the offset, where pinning the body would drop the sticky header out of
// view behind the scrim and need a restore that fights a drawer's own navigation.
export function useScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      html.style.overflow = modalOpen() ? "hidden" : "";
    };
    const watch = new MutationObserver(sync);
    watch.observe(document.body, { childList: true, subtree: true, attributeFilter: ["inert", "aria-modal"] });
    return () => {
      watch.disconnect();
      html.style.overflow = "";
    };
  }, []);
}
