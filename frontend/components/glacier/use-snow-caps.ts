"use client";

import { useEffect } from "react";

const CARDS = ".xp-group, .xp-dialog, .gh-card, .gh-awards, [data-snow-cap]";
const STATIC_CAP = 4;
const STEP = 1;
const LAUNCH_MS = 1500;
const SPEED = 70;
// A card whose top edge sits this close under another card is part of a stack
// (standings rows, stacked news cards): a drift there would fill the gap.
const STACK_GAP = 14;

interface Fall {
  el: HTMLElement;
  card: HTMLElement;
  fx: number;
  y0: number;
  t0: number;
  dur: number;
}

const maxCap = () => (window.innerWidth < 768 ? 8 : 10);

// A few lander flakes aim at the top edges of cards in view and build a snow
// cap there (a CSS variable read by the card's ::after). Only cards the
// IntersectionObserver reports are measured, and only when a scroll, resize or
// scan has marked the rects stale, at most once a frame.
export function useSnowCaps(reduced: boolean) {
  useEffect(() => {
    const landers = [...document.querySelectorAll<HTMLElement>(".glacier-lander")];
    const visible = new Set<HTMLElement>();
    const rects = new Map<HTMLElement, DOMRect>();
    const caps = new Map<HTMLElement, number>();
    let observed = new Set<HTMLElement>();
    let open: HTMLElement[] = [];
    let falls: Fall[] = [];
    let dirty = true;
    let frame = 0;
    let href = window.location.href;

    const setCap = (card: HTMLElement, px: number) => {
      caps.set(card, px);
      card.dataset.snow = "";
      card.style.setProperty("--snow-cap", `${px}px`);
    };

    const measure = () => {
      if (!dirty) return;
      dirty = false;
      rects.clear();
      for (const card of visible) rects.set(card, card.getBoundingClientRect());
      const all = [...rects];
      open = all
        .filter(([a, r]) => !all.some(([b, o]) => b !== a && o.left < r.right && o.right > r.left && o.top < r.top && o.bottom > r.top - STACK_GAP))
        .map(([card]) => card);
      if (reduced) for (const card of open) if (!caps.has(card)) setCap(card, STATIC_CAP);
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const card = e.target as HTMLElement;
        if (e.isIntersecting) visible.add(card);
        else visible.delete(card);
      }
      dirty = true;
      if (reduced) measure();
    });

    const drop = () => {
      for (const f of falls) f.el.style.opacity = "0";
      falls = [];
    };

    const scan = () => {
      if (window.location.href !== href) {
        href = window.location.href;
        drop();
        for (const card of caps.keys()) {
          delete card.dataset.snow;
          card.style.removeProperty("--snow-cap");
        }
        caps.clear();
      }
      const found = new Set(document.querySelectorAll<HTMLElement>(CARDS));
      for (const card of observed) {
        if (found.has(card)) continue;
        io.unobserve(card);
        visible.delete(card);
      }
      for (const card of found) if (!observed.has(card)) io.observe(card);
      observed = found;
      dirty = true;
      measure();
    };

    const tick = () => {
      frame = 0;
      measure();
      const now = performance.now();
      falls = falls.filter((f) => {
        const r = rects.get(f.card);
        const p = (now - f.t0) / f.dur;
        if (r && p < 1) {
          f.el.style.opacity = String(Math.min(1, p * 6));
          f.el.style.transform = `translate3d(${r.left + f.fx * r.width}px, ${f.y0 + (r.top - f.y0) * p}px, 0)`;
          return true;
        }
        f.el.style.opacity = "0";
        if (r) setCap(f.card, Math.min(maxCap(), (caps.get(f.card) ?? 0) + STEP));
        return false;
      });
      if (falls.length) frame = requestAnimationFrame(tick);
    };

    const launch = () => {
      const el = landers.find((l) => !falls.some((f) => f.el === l));
      // One lander per card at a time, so a lone card on screen still fills slowly.
      const targets = open.filter((card) => {
        const top = rects.get(card)!.top;
        return top > 24 && top < window.innerHeight && (caps.get(card) ?? 0) < maxCap() && !falls.some((f) => f.card === card);
      });
      if (!el || !targets.length) return;
      const card = targets[Math.floor(Math.random() * targets.length)];
      const top = rects.get(card)!.top;
      const y0 = Math.max(-10, top - 480);
      falls.push({ el, card, fx: 0.08 + Math.random() * 0.84, y0, t0: performance.now(), dur: ((top - y0) / SPEED) * 1000 });
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const pulse = () => {
      if (document.hidden) return;
      scan();
      if (!reduced) launch();
    };

    const stale = () => {
      dirty = true;
    };

    // rAF already stops in a hidden tab; dropping the falls stops them all
    // landing at once on the first frame back.
    const onVisibility = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(frame);
      frame = 0;
      drop();
    };

    scan();
    const timer = setInterval(pulse, LAUNCH_MS);
    window.addEventListener("scroll", stale, { capture: true, passive: true });
    window.addEventListener("resize", stale);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("scroll", stale, { capture: true });
      window.removeEventListener("resize", stale);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);
}
