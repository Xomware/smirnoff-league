"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import { useSnowCaps } from "./use-snow-caps";

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

// Seeded so the static export's HTML matches the hydrated client and tests.
const FLAKES = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 70 }, () => {
    const size = 2 + rnd() * 5;
    return {
      left: `${(rnd() * 100).toFixed(2)}%`,
      width: size,
      height: size,
      opacity: 0.5 + rnd() * 0.5,
      animationDuration: `${(9 + rnd() * 10).toFixed(1)}s`,
      animationDelay: `${(-rnd() * 18).toFixed(1)}s`,
      "--drift": `${Math.round(rnd() * 120 - 60)}px`,
    } as CSSProperties;
  });
})();

// Hoisted so a thrown snowball re-renders without diffing 70 flakes.
const SNOW = (
  <div className="glacier-snow" aria-hidden="true">
    {FLAKES.map((style, i) => (
      <span key={i} className="glacier-flake" style={style} />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <span key={`lander-${i}`} className="glacier-lander" />
    ))}
  </div>
);

export function Effects() {
  const reduced = useReducedMotion();
  const [balls, setBalls] = useState<Ball[]>([]);
  const nextId = useRef(1);
  useSnowCaps(reduced);

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
