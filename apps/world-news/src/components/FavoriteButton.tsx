"use client";

import { useFavourites } from "@/lib/useFavorites";

// A star toggle for a country or topic. Persists to localStorage via the
// favourites hook so the choice survives reloads and shows on the home page.
export default function FavoriteButton({
  kind,
  id,
  label,
  size = "md",
}: {
  kind: "country" | "topic";
  id: string;
  label: string;
  size?: "sm" | "md";
}) {
  const { isCountry, isTopic, toggleCountry, toggleTopic } = useFavourites();
  const active = kind === "country" ? isCountry(id) : isTopic(id);
  const toggle = () =>
    kind === "country" ? toggleCountry({ id, label }) : toggleTopic({ id, label });

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? `Unstar ${label}` : `Star ${label}`}
      title={active ? "Remove from favourites" : "Add to favourites"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
        size === "sm" ? "text-xs" : "text-sm"
      } ${
        active
          ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
          : "border-rule bg-panel text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <span aria-hidden>{active ? "★" : "☆"}</span>
      {active ? "Favourited" : "Favourite"}
    </button>
  );
}
