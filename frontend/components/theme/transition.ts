import { flushSync } from "react-dom";

import { PANEL_ICICLES } from "@/components/glacier/Frost";

import "./transition.css";

export type Theme = "xp" | "glacier";

// The moment each overlay fully covers the screen. The CSS keyframe delays in
// transition.css are written against these and TOTAL_MS.
const COVERED_MS: Record<Theme, number> = { glacier: 500, xp: 400 };
const TOTAL_MS = 1200;

let running: Promise<void> | null = null;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Seeded so every switch shatters the same way.
function seeded(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const FERN = `<svg viewBox="-30 0 60 100"><path d="M0 0V100${[12, 26, 40, 54, 68, 82]
  .map((y, i) => {
    const w = 26 - i * 3.6;
    return `M0 ${y}L${-w} ${y + w * 0.8}M0 ${y}L${w} ${y + w * 0.8}M${-w / 2} ${y + w * 0.4}L${-w / 2 - 5} ${y + w * 0.4 - 3}M${w / 2} ${y + w * 0.4}L${w / 2 + 5} ${y + w * 0.4 - 3}`;
  })
  .join("")}"/></svg>`;

// [left%, top%, rotation]: rotation points the fern's stem into the screen.
const FERNS = [
  [0, 0, -45], [100, 0, 45], [0, 100, -135], [100, 100, 135],
  [30, 0, 5], [70, 0, -8], [0, 45, -80], [100, 55, 85], [40, 100, 175], [75, 100, -170],
];

const BLOOMS = [[0, 0], [100, 0], [0, 100], [100, 100], [50, 0], [50, 100], [0, 50], [100, 50]];

function shatter() {
  const rnd = seeded(11);
  const radii = [0, 17, 40, 95];
  const slices = 9;
  const points = radii.map((r, ring) =>
    Array.from({ length: slices }, (_, j) => {
      const a = ((j + (ring ? rnd() * 0.6 - 0.3 : 0)) / slices) * Math.PI * 2;
      const len = ring === radii.length - 1 ? r : r * (0.85 + rnd() * 0.3);
      return [50 + Math.cos(a) * len, 50 + Math.sin(a) * len].map((v) => Math.round(v * 10) / 10);
    }),
  );
  const shards: string[] = [];
  const cracks: string[] = [];
  for (let ring = 0; ring < radii.length - 1; ring++) {
    for (let j = 0; j < slices; j++) {
      const k = (j + 1) % slices;
      const poly = [points[ring][j], points[ring][k], points[ring + 1][k], points[ring + 1][j]];
      const [cx, cy] = [0, 1].map((axis) => poly.reduce((sum, p) => sum + p[axis], 0) / 4);
      const style = [
        `clip-path:polygon(${poly.map(([x, y]) => `${x}% ${y}%`).join(",")})`,
        `transform-origin:${cx.toFixed(1)}% ${cy.toFixed(1)}%`,
        `--dx:${((cx - 50) * 0.6).toFixed(1)}vw`,
        `--rot:${Math.round(rnd() * 70 - 35)}deg`,
        `--tint:${(rnd() * 0.3).toFixed(2)}`,
        `animation-delay:${750 + ring * 40 + Math.round(rnd() * 30)}ms`,
      ];
      shards.push(`<i class="tt-shard" style="${style.join(";")}"></i>`);
      const [a, b, c] = [points[ring][j], points[ring + 1][j], points[ring][k]];
      cracks.push(`<path class="tt-crack-radial" d="M${a}L${b}"/>`);
      if (ring) cracks.push(`<path class="tt-crack-ring" d="M${a}L${c}"/>`);
    }
  }
  return { shards: shards.join(""), cracks: cracks.join("") };
}

function freezeMarkup() {
  const { shards, cracks } = shatter();
  const ferns = FERNS.map(
    ([x, y, rot], i) => `<span class="tt-fern" style="left:${x}%;top:${y}%;--rot:${rot}deg;animation-delay:${i * 25}ms">${FERN}</span>`,
  ).join("");
  const blooms = BLOOMS.map(
    ([x, y], i) => `<i class="tt-bloom" style="left:${x}%;top:${y}%;animation-delay:${i < 4 ? 0 : 90}ms"></i>`,
  ).join("");
  return `<div class="tt-cover"><i class="tt-frost"></i>${blooms}${ferns}</div>
<svg class="tt-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">${cracks}</svg>
<div class="tt-shards">${shards}</div>`;
}

function meltMarkup() {
  const rnd = seeded(5);
  const drips = Array.from({ length: 14 }, (_, i) => {
    const style = `left:${(i * 7 + rnd() * 5).toFixed(1)}%;width:${(1 + rnd() * 2).toFixed(1)}vmin;height:${(10 + rnd() * 22).toFixed(1)}vh;animation-delay:${700 + Math.round(rnd() * 80)}ms`;
    return `<i class="tt-drip" style="${style}"></i>`;
  }).join("");
  const runs = Array.from({ length: 8 }, (_, i) => {
    return `<i class="tt-run" style="left:${(6 + i * 12 + rnd() * 6).toFixed(1)}%;animation-delay:${480 + Math.round(rnd() * 200)}ms"></i>`;
  }).join("");
  return `<div class="tt-sheet">${runs}
<div class="tt-loading xp-dialog"><p class="xp-dialog-title">Smirnoff League</p><p class="tt-loading-body">Loading your settings...</p><div class="tt-progress"><i></i><i></i><i></i></div></div>
<svg class="tt-fringe" viewBox="0 0 400 22" preserveAspectRatio="none"><path d="${PANEL_ICICLES}"/></svg>${drips}</div>`;
}

async function play(to: Theme, apply: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (!document.startViewTransition) return apply();
    const root = document.documentElement;
    root.classList.add("theme-fade");
    try {
      await document.startViewTransition(() => flushSync(apply)).finished;
    } finally {
      root.classList.remove("theme-fade");
    }
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = `theme-transition tt-to-${to}`;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = to === "glacier" ? freezeMarkup() : meltMarkup();
  document.body.append(overlay);
  try {
    await wait(COVERED_MS[to]);
    apply();
    await wait(TOTAL_MS - COVERED_MS[to]);
  } finally {
    overlay.remove();
  }
}

// Covers the screen, calls apply() (the theme swap) while nothing is visible,
// then reveals the new theme. A call made while one is running is dropped.
export function runThemeTransition(to: Theme, apply: () => void): Promise<void> {
  if (running) return running;
  running = play(to, apply).finally(() => {
    running = null;
  });
  return running;
}
