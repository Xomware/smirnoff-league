"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";

import { useMediaQuery } from "@/lib/use-media-query";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import "./effects.css";

const IGNORE = "a, button, input, textarea, select, label, [role=button], [data-no-snowball]";
const SPLAT_MS = 1300;

interface Point {
  x: number;
  y: number;
}

interface Ball extends Point {
  id: number;
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

// Hoisted so a pointer move re-renders the trail without diffing 70 flakes.
const SNOW = (
  <div className="glacier-snow">
    {FLAKES.map((style, i) => (
      <span key={i} className="glacier-flake" style={style} />
    ))}
  </div>
);

export function Effects() {
  const reduced = useReducedMotion();
  const fine = useMediaQuery("(pointer: fine)");
  const [cursor, setCursor] = useState<Point | null>(null);
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

  useEffect(() => {
    if (reduced || !fine) return;
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, fine]);

  if (reduced) return null;
  return (
    <div className="glacier-effects" aria-hidden="true">
      {SNOW}
      {fine &&
        cursor &&
        [0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="glacier-trail"
            style={{
              transform: `translate(${cursor.x + i * 3}px, ${cursor.y + i * 4}px)`,
              opacity: 1 - i * 0.18,
              transitionDuration: `${0.12 + i * 0.1}s`,
            }}
          />
        ))}
      {balls.map((b) => (
        <Fragment key={b.id}>
          <span className="glacier-ball" style={{ left: b.x, top: b.y, "--from": `${b.from}px` } as CSSProperties} />
          <span className="glacier-splat" style={{ left: b.x, top: b.y }} />
        </Fragment>
      ))}
    </div>
  );
}
