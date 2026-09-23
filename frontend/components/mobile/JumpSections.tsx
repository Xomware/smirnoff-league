"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

interface Section {
  label: string;
  panel: () => ReactNode;
}

interface JumpSectionsProps {
  label: string;
  sections: Section[];
}

// A desktop view's tabs, stacked on one scrolling page, with a single chip
// row that sticks to the top and jumps to each section.
export function JumpSections({ label, sections }: JumpSectionsProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const targets = useRef<(HTMLElement | null)[]>([]);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // The band just under the sticky chips decides which section is current.
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(targets.current.indexOf(hit.target as HTMLElement));
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    targets.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [sections.length]);

  useEffect(() => {
    chips.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const jump = (i: number) => {
    setActive(i);
    targets.current[i]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <>
      <nav aria-label={label} className="m-jump">
        {sections.map((s, i) => (
          <button
            key={s.label}
            ref={(el) => {
              chips.current[i] = el;
            }}
            type="button"
            className="m-jump-chip"
            aria-current={i === active ? "true" : undefined}
            onClick={() => jump(i)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      {sections.map((s, i) => (
        <section
          key={s.label}
          ref={(el) => {
            targets.current[i] = el;
          }}
          aria-labelledby={`${id}-${i}`}
          className="m-section m-jump-target"
        >
          <h2 id={`${id}-${i}`} className="m-section-title">
            {s.label}
          </h2>
          {s.panel()}
        </section>
      ))}
    </>
  );
}
