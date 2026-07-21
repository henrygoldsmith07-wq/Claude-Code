"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored) as T);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (loaded) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // quota exceeded or private mode — ignore
      }
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}
