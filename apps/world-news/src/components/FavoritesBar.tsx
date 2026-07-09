"use client";

import Link from "next/link";
import { useFavourites } from "@/lib/useFavorites";

// Quick links to the user's starred countries and topics, shown on the home
// page. Renders nothing until there's at least one favourite.
export default function FavoritesBar() {
  const { favourites } = useFavourites();
  const { countries, topics } = favourites;
  if (countries.length === 0 && topics.length === 0) return null;

  return (
    <div className="pointer-events-auto mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
      <span className="w-full text-xs uppercase tracking-wide text-muted">
        ★ Your favourites
      </span>
      {countries.map((c) => (
        <Link
          key={`c-${c.id}`}
          href={`/country/${c.id}`}
          className="rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs text-amber-200 backdrop-blur transition-colors hover:border-amber-300"
        >
          {c.label}
        </Link>
      ))}
      {topics.map((t) => (
        <Link
          key={`t-${t.id}`}
          href={`/topic/${t.id}`}
          className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs text-accent backdrop-blur transition-colors hover:border-accent"
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
