"use client";

import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// A shared clock.
//
// Retention, spacing and "days since" all depend on the current time, and
// reading it during render makes a component impure — the same inputs would
// produce different output on every pass. So the time is an external store that
// ticks once a minute, which is both correct and a good deal cheaper than the
// alternative of every component minting its own `new Date()`.
// ---------------------------------------------------------------------------

const TICK_MS = 60_000;

let current = new Date().toISOString();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  current = new Date().toISOString();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) timer = setInterval(tick, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): string {
  return current;
}

/** Current ISO instant, stable within a render and refreshed each minute. */
export function useNow(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** For non-render code that needs the same clock. */
export function nowIso(): string {
  return new Date().toISOString();
}
