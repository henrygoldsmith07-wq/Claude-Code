'use client';

import { useEffect, useState } from 'react';

/**
 * localStorage-backed state for the OS mini-apps. Local-first by design:
 * every sub-OS works with zero backend today; the swap to Supabase later is
 * confined to this hook. SSR-safe — reads only after mount.
 */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {
      // corrupt entry — fall back to initial
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — state still works in memory
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Today as YYYY-MM-DD in local time. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysUntil(date: string): number {
  const ms = new Date(date + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}
