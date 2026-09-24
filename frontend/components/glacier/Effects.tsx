"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import "./effects.css";

const IGNORE = "a, button, input, textarea, select, label, [role=button], [data-no-snowball]";
const SPLAT_MS = 1300;
// Display text only: body copy and table numbers have to stay readable.
const WOBBLE = "h1, h2, h3, nav a, nav button, .glacier-brand, .gl-brand, .gh-link";

interface Ball {
  id: number;
  x: number;
  y: number;
  from: number;
}

type Segment = [number, number, number, number];

// One arm of each crystal, pointing up from the centre in a 24-unit box.
// Mirrored pairs are listed as both halves; the arm is repeated six times.
const SHAPES: Segment[][] = [
  [[0, 0, 0, -10], [0, -10, -2, -8.4], [0, -10, 2, -8.4]],
  [[0, 0, 0, -10.5], [0, -4.5, -3.2, -7], [0, -4.5, 3.2, -7], [0, -7.5, -2, -9.3], [0, -7.5, 2, -9.3]],
  [
    [0, -2.2, 0, -10.8],
    [0, -2.2, 1.9, -1.1],
    [0, -4.6, -3.8, -6.8],
    [0, -4.6, 3.8, -6.8],
    [0, -7.8, -2.2, -9.4],
    [0, -7.8, 2.2, -9.4],
  ],
];

const sixfold = (arm: Segment[]) =>
  [0, 1, 2, 3, 4, 5]
    .flatMap((k) => {
      const [c, s] = [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)];
      const at = (x: number, y: number) => `${(x * c - y * s).toFixed(2)} ${(x * s + y * c).toFixed(2)}`;
      return arm.map(([x1, y1, x2, y2]) => `M${at(x1, y1)}L${at(x2, y2)}`);
    })
    .join("");

// Far flakes are most of the fall; a few near ones are big and bright.
const DEPTHS = [
  { share: 0.6, size: [6, 9.5], opacity: [0.35, 0.55], fall: [17, 24], line: 0.65, shapes: [0] },
  { share: 0.28, size: [10, 15], opacity: [0.6, 0.8], fall: [12, 16], line: 1, shapes: [0, 1, 2] },
  { share: 0.12, size: [16, 22], opacity: [0.85, 1], fall: [8, 11], line: 1.3, shapes: [1, 2] },
];

// Seeded so the static export's HTML matches the hydrated client and tests.
const FLAKES = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pick = ([lo, hi]: number[]) => lo + rnd() * (hi - lo);
  return Array.from({ length: 76 }, () => {
    const roll = rnd();
    const depth = roll < DEPTHS[0].share ? DEPTHS[0] : roll < DEPTHS[0].share + DEPTHS[1].share ? DEPTHS[1] : DEPTHS[2];
    const size = Math.round(pick(depth.size));
    const fall = pick(depth.fall);
    const flutter = 5 + rnd() * 5;
    return {
      size,
      shape: depth.shapes[Math.floor(rnd() * depth.shapes.length)],
      style: {
        left: `${(rnd() * 100).toFixed(2)}%`,
        opacity: pick(depth.opacity).toFixed(2),
        animationDuration: `${fall.toFixed(1)}s`,
        animationDelay: `${(-rnd() * fall).toFixed(1)}s`,
        "--drift": `${Math.round(rnd() * 80 - 40)}px`,
      } as CSSProperties,
      art: {
        // Stroke width is in the 24-unit box, so scale it to keep the line near `line` px.
        "--sw": ((depth.line * 24) / size).toFixed(2),
        "--sway": `${Math.round(6 + rnd() * size)}px`,
        animationDuration: `${flutter.toFixed(1)}s`,
        animationDelay: `${(-rnd() * flutter).toFixed(1)}s`,
        animationDirection: rnd() < 0.5 ? "normal" : "reverse",
      } as CSSProperties,
    };
  });
})();

// Hoisted so a thrown snowball re-renders without diffing the flakes.
const SNOW = (
  <div className="glacier-snow" aria-hidden="true">
    <svg width="0" height="0" className="glacier-flake-defs">
      {SHAPES.map((arm, i) => {
        const d = sixfold(arm);
        return (
          <symbol key={i} id={`glacier-flake-${i}`} viewBox="-12 -12 24 24">
            <path className="glacier-flake-line" d={d} />
          </symbol>
        );
      })}
    </svg>
    {FLAKES.map((f, i) => (
      <span key={i} className="glacier-flake" style={f.style}>
        <svg width={f.size} height={f.size} style={f.art}>
          <use href={`#glacier-flake-${f.shape}`} />
        </svg>
      </span>
    ))}
  </div>
);

export function Effects() {
  const reduced = useReducedMotion();
  const [balls, setBalls] = useState<Ball[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    if (reduced) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || e.target.closest(IGNORE)) return;
      const { clientX: x, clientY: y } = e;
      const width = window.innerWidth;
      const ball = { id: nextId.current++, x, y, from: x < width / 2 ? -(x + 60) : width - x + 60 };
      setBalls((all) => [...all, ball]);
      setTimeout(() => setBalls((all) => all.filter((b) => b.id !== ball.id)), SPLAT_MS);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [reduced]);

  // On body, like XpCursor, so dialogs portaled out of the Glacier root get it too.
  useEffect(() => {
    document.body.classList.add("glacier-cursor");
    return () => document.body.classList.remove("glacier-cursor");
  }, []);

  // A data attribute rather than a class: React rewrites className on re-render,
  // but leaves attributes it never set alone.
  useEffect(() => {
    if (reduced) return;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(WOBBLE);
      if (!el || el.dataset.wobble) return;
      el.dataset.wobble = e.movementX < 0 ? "left" : "right";
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "glacier-wobble" && e.target instanceof HTMLElement) delete e.target.dataset.wobble;
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("animationend", onEnd);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("animationend", onEnd);
    };
  }, [reduced]);

  if (reduced) return null;
  return (
    <>
      {SNOW}
      <div className="glacier-effects" aria-hidden="true">
        {balls.map((b) => (
          <Fragment key={b.id}>
            <span className="glacier-ball" style={{ left: b.x, top: b.y, "--from": `${b.from}px` } as CSSProperties} />
            <span className="glacier-splat" style={{ left: b.x, top: b.y }} />
          </Fragment>
        ))}
      </div>
    </>
  );
}
