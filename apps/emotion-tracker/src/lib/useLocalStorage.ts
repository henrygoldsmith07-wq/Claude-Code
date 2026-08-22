"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState<T>(initialValue);

  // Reads localStorage on mount (client-only, so state starts empty during
  // SSR and hydration, then syncs). This unavoidably causes one extra
  // render after mount; that's the standard tradeoff for SSR-safe
  // localStorage-backed state, not a bug.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        try {
          const parsed: unknown = JSON.parse(stored);
          // Guard against corrupt-but-valid JSON of the wrong shape.
          const shapeOk = Array.isArray(initialValue) ? Array.isArray(parsed) : parsed !== null && typeof parsed === "object";
          if (shapeOk) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setValue(parsed as T);
          }
        } catch {
          // ignore corrupt storage
        }
      }
    } catch {
      // blocked storage (e.g. Safari private mode) — run in memory only
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or blocked storage — keep state in memory
      console.warn(`Could not persist "${key}" to localStorage; changes stay in this session only.`);
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
