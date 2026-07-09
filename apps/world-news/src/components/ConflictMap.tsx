"use client";

import { useEffect } from "react";
import type { ConflictLine } from "@/lib/gemini";

interface Feature {
  properties: { name: string; iso_a2: string };
  geometry: { type: string; coordinates: unknown };
}

// Ray-casting point-in-polygon over a single ring of [lng, lat] pairs.
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonsOf(feature: Feature): [number, number][][][] {
  const g = feature.geometry;
  if (g.type === "Polygon") return [g.coordinates as [number, number][][]];
  if (g.type === "MultiPolygon") return g.coordinates as [number, number][][][];
  return [];
}

function countryContains(feature: Feature, lat: number, lng: number): boolean {
  for (const poly of polygonsOf(feature)) {
    if (poly.length && pointInRing(lat, lng, poly[0])) return true;
  }
  return false;
}

// A flat (equirectangular) map of a single conflict: draws the front-line path
// and shades the countries involved. Opened by clicking a war line on a globe.
export default function ConflictMap({
  conflict,
  features,
  onClose,
}: {
  conflict: ConflictLine;
  features: Feature[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const path = conflict.path;
  const lats = path.map((p) => p[0]);
  const lngs = path.map((p) => p[1]);
  // Bounding box around the front line, padded so surrounding areas are visible.
  const padLat = Math.max(2.5, (Math.max(...lats) - Math.min(...lats)) * 0.5);
  const padLng = Math.max(2.5, (Math.max(...lngs) - Math.min(...lngs)) * 0.5);
  const minLat = Math.min(...lats) - padLat;
  const maxLat = Math.max(...lats) + padLat;
  const minLng = Math.min(...lngs) - padLng;
  const maxLng = Math.max(...lngs) + padLng;

  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180) || 1;
  const lngSpan = (maxLng - minLng) * kx || 1;
  const latSpan = maxLat - minLat || 1;
  const W = 760;
  const H = Math.max(280, Math.min(600, (W * latSpan) / lngSpan));
  const px = (lng: number) => (((lng - minLng) * kx) / lngSpan) * W;
  const py = (lat: number) => ((maxLat - lat) / latSpan) * H;

  // Countries with any vertex inside the view, and which of those the front line
  // actually runs through (the "areas involved").
  const involved = new Set<string>();
  for (const [lat, lng] of path) {
    for (const f of features) {
      if (countryContains(f, lat, lng)) involved.add(f.properties.iso_a2);
    }
  }
  const inView = features.filter((f) => {
    for (const poly of polygonsOf(f)) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) return true;
        }
      }
    }
    return false;
  });
  const involvedNames = inView
    .filter((f) => involved.has(f.properties.iso_a2))
    .map((f) => f.properties.name);

  const linePts = path.map(([lat, lng]) => `${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(" ");

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-rule bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-red-300">⚔ Active conflict</p>
            <h2 className="text-lg font-semibold tracking-tight">{conflict.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-rule px-2.5 py-1 text-sm text-muted hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        </div>

        <div className="bg-[#0a1120] p-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            style={{ maxHeight: "60vh" }}
            role="img"
            aria-label={`Flat map of ${conflict.label}`}
          >
            {/* Countries in view; involved ones shaded red */}
            {inView.map((f, fi) =>
              polygonsOf(f).map((poly, pi) => {
                const isInvolved = involved.has(f.properties.iso_a2);
                return (
                  <polygon
                    key={`${fi}-${pi}`}
                    points={poly[0]
                      .map(([lng, lat]) => `${px(lng).toFixed(1)},${py(lat).toFixed(1)}`)
                      .join(" ")}
                    fill={isInvolved ? "rgba(248,113,113,0.22)" : "#16233b"}
                    stroke={isInvolved ? "#f87171" : "#2a3b5a"}
                    strokeWidth={isInvolved ? 1 : 0.5}
                  />
                );
              }),
            )}
            {/* Front line */}
            <polyline
              points={linePts}
              fill="none"
              stroke="#f87171"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {path.map(([lat, lng], i) => (
              <circle key={i} cx={px(lng)} cy={py(lat)} r={3.5} fill="#fca5a5" stroke="#7f1d1d" />
            ))}
          </svg>
        </div>

        <div className="px-5 py-3 text-sm">
          <span className="text-muted">Areas involved: </span>
          {involvedNames.length ? (
            involvedNames.join(", ")
          ) : (
            <span className="text-muted">around {conflict.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
