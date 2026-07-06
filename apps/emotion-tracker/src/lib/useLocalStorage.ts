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
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(stored) as T);
      } catch {
        // ignore corrupt storage
      }
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
