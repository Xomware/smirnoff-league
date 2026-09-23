"use client";

import { useEffect, useState } from "react";

const HOUR = 3_600_000;

/** The clock for countdowns: every minute, and every second once a deadline is under an hour off. */
export function useNow(deadlines: number[]): number {
  const [now, setNow] = useState(Date.now);
  const fast = deadlines.some((d) => d > now && d - now < HOUR);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [fast]);

  return now;
}
