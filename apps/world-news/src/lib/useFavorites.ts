"use client";

import { useCallback, useEffect, useState } from "react";

// A starred country or topic. `label` is stored alongside the id so the
// favourites bar can render names without importing server-only topic data.
export interface FavItem {
  id: string;
  label: string;
}

export interface Favourites {
  countries: FavItem[];
  topics: FavItem[];
}

const KEY = "world-news-favourites";
const EVENT = "wn-favourites-changed";
const EMPTY: Favourites = { countries: [], topics: [] };

function read(): Favourites {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Favourites>;
    return {
      countries: Array.isArray(parsed.countries) ? parsed.countries : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    };
  } catch {
    return EMPTY;
  }
}

// localStorage-backed favourites (no login). Kept in sync across components in
// the same tab via a custom event, and across tabs via the storage event.
export function useFavourites() {
  const [favourites, setFavourites] = useState<Favourites>(EMPTY);

  useEffect(() => {
    setFavourites(read());
    const sync = () => setFavourites(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: Favourites) => {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setFavourites(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(
    (kind: "countries" | "topics", item: FavItem) => {
      const current = read();
      const list = current[kind];
      const exists = list.some((f) => f.id === item.id);
      const nextList = exists
        ? list.filter((f) => f.id !== item.id)
        : [...list, item];
      save({ ...current, [kind]: nextList });
    },
    [save],
  );

  return {
    favourites,
    isCountry: (id: string) => favourites.countries.some((f) => f.id === id),
    isTopic: (id: string) => favourites.topics.some((f) => f.id === id),
    toggleCountry: (item: FavItem) => toggle("countries", item),
    toggleTopic: (item: FavItem) => toggle("topics", item),
  };
}
