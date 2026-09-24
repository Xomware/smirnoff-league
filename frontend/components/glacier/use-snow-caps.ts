"use client";

import { useEffect } from "react";

type Kind = "card" | "button" | "heading";

const CARDS = ".xp-group, .xp-dialog, .gh-card, .gh-awards, [data-snow-cap]:not([data-snow-cap='button'])";
const BUTTONS = ".gh-button, .gh-cta, .glacier-pill, .gt-due, .m-subtab, .glacier-subnav a[aria-current], .xp-button:not(table *), [data-snow-cap='button']";
// Display headings only: small labels and anything inside a table or a control stay bare.
const HEADINGS = ":is(h1, h2, h3):not(table *, button *, a *)";
const HEADING_MIN_PX = 18;
const MAX: Record<Kind, [desktop: number, phone: number]> = { card: [16, 12], button: [6, 6], heading: [5, 5] };
// A card whose top edge sits this close under another card is part of a stack
// (standings rows, stacked news cards): a full drift there would fill the gap.
const STACK_GAP = 14;
const STACK_MAX = 4;
const TRACKED = 40;
const LAUNCH_MS = 300;
const SCAN_EVERY = 2;
const DROP = 300;
const SPEED = 110;

interface Target {
  kind: Kind;
  at: "after" | "before";
  seed: number;
}

interface Fall {
  el: HTMLElement;
  target: HTMLElement;
  fx: number;
  y0: number;
  t0: number;
  dur: number;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
};

const round = (px: number) => Math.round(px * 10) / 10;

// Drift height at 13 points across the top, as a share of the cap: high at
// both corners, dipping in the middle, jittered per element.
export function driftHeights(seed: number): number[] {
  let s = Math.floor(seed * 233280);
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 13 }, (_, i) => Math.min(1, 0.28 + 0.66 * Math.abs(i / 6 - 1) ** 2.5 + (rnd() - 0.5) * 0.2));
}

// viewBox -3..203 wide: the drift spans 0..200 and the lips overhang 3 either
// side. y=20 is the element's top edge, so the lips droop below it.
const shape = (heights: number[]) => {
  const pts = heights.map((h, i) => [round((i * 200) / (heights.length - 1)), round(20 - 19 * h)]);
  let d = `M-3 26C-3 22 -2 ${pts[0][1]} 0 ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += `C${pts[i - 1][0] + 7} ${pts[i - 1][1]} ${pts[i][0] - 7} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]}`;
  d += `C202 ${pts.at(-1)![1]} 203 22 203 26C201 21.5 198 21 195 21H5C2 21 -1 21.5 -3 26Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 0 206 30" preserveAspectRatio="none"><linearGradient id="g" x2="0" y2="1"><stop offset=".3" stop-color="#f6fbff"/><stop offset="1" stop-color="#d6e8f6"/></linearGradient><path fill="url(#g)" d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const classify = (el: HTMLElement): Target | null => {
  const kind: Kind = el.matches(CARDS) ? "card" : el.matches(BUTTONS) ? "button" : "heading";
  const style = getComputedStyle(el);
  // The cap sits outside the box, so anything that clips its overflow would hide it.
  if (/hidden|clip|auto|scroll/.test(style.overflow)) return null;
  if (kind === "heading" && !(parseFloat(style.fontSize) >= HEADING_MIN_PX)) return null;
  const free = (pseudo: string) => ["none", "normal"].includes(getComputedStyle(el, pseudo).content);
  const at = free("::after") ? "after" : free("::before") ? "before" : null;
  if (!at) return null;
  const text = el.textContent?.slice(0, 60) ?? "";
  const prev = el.previousElementSibling?.textContent?.slice(0, 30) ?? "";
  return { kind, at, seed: hash(`${el.tagName}|${el.className}|${text}|${prev}`) };
};

// Lander flakes aim at the tops of cards, buttons and headings in view and
// build a snow cap there (CSS variables read by a pseudo-element). Every target
// starts with some snow, seeded from its content so it doesn't reshuffle. Only
// the IntersectionObserver's visible targets nearest the middle of the screen
// are measured, and only when a scroll, resize or scan has marked them stale.
export function useSnowCaps(reduced: boolean) {
  useEffect(() => {
    const landers = [...document.querySelectorAll<HTMLElement>(".glacier-lander")];
    const known = new WeakMap<HTMLElement, Target | null>();
    const visible = new Set<HTMLElement>();
    const rects = new Map<HTMLElement, DOMRect>();
    const spans = new Map<HTMLElement, [number, number]>();
    const stacked = new Set<HTMLElement>();
    const caps = new Map<HTMLElement, number>();
    const maxes = new Map<HTMLElement, number>();
    let observed = new Set<HTMLElement>();
    let falls: Fall[] = [];
    let dirty = true;
    let frame = 0;
    let pulses = 0;
    let href = window.location.href;

    const maxOf = (el: HTMLElement) => (stacked.has(el) ? STACK_MAX : MAX[known.get(el)!.kind][window.innerWidth < 768 ? 1 : 0]);

    // The drift box is sized once for the max and grows by scaleY, so a landing
    // never costs a layout.
    const setCap = (el: HTMLElement, px: number) => {
      const max = maxOf(el);
      caps.set(el, px);
      if (maxes.get(el) !== max) {
        maxes.set(el, max);
        el.style.setProperty("--snow-max", `${max}px`);
      }
      el.style.setProperty("--snow-k", (px / max).toFixed(3));
    };

    const seed = (el: HTMLElement, { kind, at, seed: s }: Target) => {
      const max = maxOf(el);
      const share = kind !== "card" ? (s < 0.5 ? 0.5 + s : 0) : stacked.has(el) ? 0.75 + 0.25 * s : 0.4 + 0.3 * s;
      if (getComputedStyle(el).position === "static") el.dataset.snowRel = "";
      el.dataset.snow = at;
      el.dataset.snowKind = kind;
      if (Math.floor(s * 1000) % 2) el.dataset.snowFlip = "";
      el.style.setProperty("--snow-shape", shape(driftHeights(s)));
      setCap(el, round(max * share));
    };

    // A heading's box runs the full column and its line box sits well above the
    // letters; the dusting belongs on the words themselves.
    const fitText = (el: HTMLElement, r: DOMRect) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      const span: [number, number] = [Math.round(t.left - r.left), Math.round(t.width)];
      spans.set(el, span);
      const vars = { "--snow-l": span[0], "--snow-w": span[1], "--snow-t": Math.round(t.top - r.top) };
      for (const [prop, px] of Object.entries(vars)) if (el.style.getPropertyValue(prop) !== `${px}px`) el.style.setProperty(prop, `${px}px`);
    };

    const measure = () => {
      if (!dirty) return;
      dirty = false;
      const mid = window.innerHeight / 2;
      const near = [...visible]
        .map((el) => [el, el.getBoundingClientRect()] as const)
        .sort(([, a], [, b]) => Math.abs(a.top + a.height / 2 - mid) - Math.abs(b.top + b.height / 2 - mid))
        .slice(0, TRACKED);
      rects.clear();
      stacked.clear();
      const cards = near.filter(([el]) => known.get(el)!.kind === "card");
      for (const [a, r] of cards)
        if (cards.some(([b, o]) => b !== a && o.left < r.right && o.right > r.left && o.top < r.top && o.bottom > r.top - STACK_GAP)) stacked.add(a);
      for (const [el, r] of near) {
        rects.set(el, r);
        const target = known.get(el)!;
        if (!caps.has(el)) seed(el, target);
        else if (maxes.get(el) !== maxOf(el)) setCap(el, Math.min(caps.get(el)!, maxOf(el)));
        if (target.kind === "heading") fitText(el, r);
      }
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visible.add(el);
        else visible.delete(el);
      }
      dirty = true;
      measure();
    });

    const drop = () => {
      for (const f of falls) f.el.style.opacity = "0";
      falls = [];
    };

    const clear = () => {
      for (const el of caps.keys()) {
        for (const key of ["snow", "snowKind", "snowFlip", "snowRel"]) delete el.dataset[key];
        for (const prop of ["--snow-max", "--snow-k", "--snow-shape", "--snow-l", "--snow-w", "--snow-t"]) el.style.removeProperty(prop);
      }
      caps.clear();
      maxes.clear();
      dirty = true;
    };

    const scan = () => {
      const found = new Set<HTMLElement>();
      for (const el of document.querySelectorAll<HTMLElement>(`${CARDS}, ${BUTTONS}, ${HEADINGS}`)) {
        if (!known.has(el)) known.set(el, classify(el));
        if (known.get(el)) found.add(el);
      }
      for (const el of observed) {
        if (found.has(el)) continue;
        io.unobserve(el);
        visible.delete(el);
      }
      const added = [...found].filter((el) => !observed.has(el));
      for (const el of added) io.observe(el);
      // Content that shifts without a scroll moves targets too; catch up every few scans.
      if (added.length || found.size !== observed.size || pulses % (SCAN_EVERY * 3) === 0) dirty = true;
      observed = found;
      measure();
    };

    const tick = () => {
      frame = 0;
      measure();
      const now = performance.now();
      falls = falls.filter((f) => {
        const r = rects.get(f.target);
        const p = (now - f.t0) / f.dur;
        if (r && p < 1) {
          const [left, width] = spans.get(f.target) ?? [0, r.width];
          f.el.style.opacity = String(Math.min(1, p * 6));
          f.el.style.transform = `translate3d(${r.left + left + f.fx * width}px, ${f.y0 + (r.top - f.y0) * p}px, 0)`;
          return true;
        }
        f.el.style.opacity = "0";
        if (r) {
          const max = maxOf(f.target);
          setCap(f.target, Math.min(max, round(caps.get(f.target)! + Math.max(1, max / 5))));
        }
        return false;
      });
      if (falls.length) frame = requestAnimationFrame(tick);
    };

    const launch = () => {
      const el = landers.find((l) => !falls.some((f) => f.el === l));
      if (!el) return;
      // Two landers per target at most, so snow spreads over the screen rather than one card.
      const targets = [...rects].filter(
        ([t, r]) => r.top > 24 && r.top < window.innerHeight && caps.get(t)! < maxOf(t) && falls.filter((f) => f.target === t).length < 2,
      );
      if (!targets.length) return;
      const [target, r] = targets[Math.floor(Math.random() * targets.length)];
      const y0 = Math.max(-10, r.top - DROP);
      falls.push({ el, target, fx: 0.08 + Math.random() * 0.84, y0, t0: performance.now(), dur: ((r.top - y0) / SPEED) * 1000 });
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const pulse = () => {
      if (document.hidden) return;
      const moved = window.location.href !== href;
      if (moved) {
        href = window.location.href;
        drop();
        clear();
      }
      if (moved || pulses++ % SCAN_EVERY === 0) scan();
      else measure();
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
