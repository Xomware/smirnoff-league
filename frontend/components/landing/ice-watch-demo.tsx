"use client";

import { useEffect, useRef, useState } from "react";

import { IceBadge } from "@/components/xp/IceBadge";
import { IceBottleIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

// One fake receiver, three bad weeks. Each drop ends frozen and adds an ice.
const WEEKS = [14.3, 9.6, 21.1];
const DROP_MS = 2400;
const PAUSE_MS = 1600;

interface IceWatchDemoProps {
  animate: boolean;
}

export function IceWatchDemo({ animate }: IceWatchDemoProps) {
  // Starts on the final frame: that is the prerendered and reduced-motion view.
  const [ices, setIces] = useState(WEEKS.length);
  const row = useRef<HTMLLIElement>(null);
  const pts = useRef<HTMLSpanElement>(null);
  const week = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const li = row.current;
    const p = pts.current;
    const w = week.current;
    if (!animate || !li || !p || !w) return;
    let frame = 0;
    let timer = 0;

    // Points are written straight to the DOM every frame; only the ice count,
    // which changes a handful of times, goes through React.
    const drop = (i: number) => {
      const from = WEEKS[i];
      const start = performance.now();
      w.textContent = `Week ${i + 1}`;
      li.classList.remove("ice");
      setIces(i);
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DROP_MS);
        // Ease-in: the score holds, then falls off a cliff.
        p.textContent = (from * (1 - t * t * t)).toFixed(2);
        if (t < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        li.classList.add("ice");
        setIces(i + 1);
        if (i + 1 < WEEKS.length) timer = window.setTimeout(() => drop(i + 1), PAUSE_MS);
      };
      frame = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        drop(0);
      },
      { threshold: 1 },
    );
    io.observe(li);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [animate]);

  return (
    <Window title="Ice Watch - Live (demo)" icon={<IceBottleIcon />}>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold">
        <span className="landing-live-dot" aria-hidden />
        LIVE <span className="font-normal">Demo data. Fake player, real consequences.</span>
      </p>
      <ul className="bg-(--xp-cream)">
        <li ref={row} data-testid="ice-watch-row" className="xp-player-row ice">
          <span className="xp-player-pos">WR</span>
          <span className="xp-player-name">
            Demo Receiver <span ref={week} className="text-xs">Week {WEEKS.length}</span>
          </span>
          <IceBadge count={ices} />
          <span ref={pts} className="xp-player-pts">0.00</span>
        </li>
      </ul>
      <p className="mt-2 text-xs leading-relaxed">
        When a starter hits zero the row freezes over and the badge ticks up. Nobody can hear
        you scream in a frozen row.
      </p>
    </Window>
  );
}
