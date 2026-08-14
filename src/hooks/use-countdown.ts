import { useEffect, useState } from "react";

/**
 * Seconds remaining until `until` (an epoch ms timestamp), ticking once a
 * second and stopping at zero.
 *
 * The clock is read inside the timer callbacks, never during render — a render
 * must be pure, and a component that reads `Date.now()` while rendering
 * produces a different result every time React happens to re-run it.
 *
 * Each tick recomputes from the deadline rather than decrementing a counter, so
 * the value stays honest across a backgrounded app: a member who leaves for five
 * minutes returns to an expired limit, not to a timer that paused with her.
 */
export function useCountdown(until: number | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (until === null) return;

    const update = () => {
      const next = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSeconds(next);
      return next;
    };

    // A 0ms timer for the first read: setState inside a scheduled callback is a
    // subscription to an external system, which is what an effect is for —
    // calling it synchronously in the effect body is a cascading render.
    const first = setTimeout(update, 0);
    const interval = setInterval(() => {
      if (update() === 0) clearInterval(interval);
    }, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [until]);

  // No deadline means no countdown, without waiting for a tick to say so.
  return until === null ? 0 : seconds;
}
