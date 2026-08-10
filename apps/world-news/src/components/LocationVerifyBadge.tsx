"use client";
import type { CountryNews } from "@/lib/gemini";

function coordsValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export default function LocationVerifyBadge({ news }: { news: CountryNews }) {
  const points = news.points ?? [];
  if (points.length === 0) return null;
  const invalid = points.filter((p) => !coordsValid(p.lat, p.lng));
  const multiCountry = Array.from(new Set(points.map((p) => p.countryCode).filter(Boolean)));
  const hasMulti = multiCountry.length >= 3;
  if (invalid.length === 0 && !hasMulti) {
    return (
      <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
        Location check: {points.length} point{points.length === 1 ? "" : "s"} with valid coordinates
        {multiCountry.length > 1 ? ` · ${multiCountry.length} countries represented` : ""}. Dots use
        approximate real coordinates; globe dot placement verified client-side.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
      <p className="font-medium text-amber-300">Location note</p>
      {invalid.length > 0 && (
        <p className="mt-1 text-muted">
          {invalid.length} point{invalid.length === 1 ? "" : "s"} with invalid coordinates filtered
          (not plotted). Remaining {points.length - invalid.length} plotted.
        </p>
      )}
      {hasMulti && (
        <p className="mt-1 text-muted">
          Multi-country coverage: {multiCountry.join(", ")} — stories spanning countries share tags so
          the globe can link related dots across borders. Location verification checks per-point country
          codes (see <code className="rounded bg-panel-soft px-1">locationVerifier.ts</code>).
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted">
        Articles covering multiple countries are kept as one event with a multi-country timeline —
        country pages include them when any attributed country matches.
      </p>
    </div>
  );
}
