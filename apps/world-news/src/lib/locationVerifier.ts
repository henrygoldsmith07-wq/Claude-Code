// Location extraction verifier: checks that claimed coordinates actually lie
// inside the claimed country polygon; flags and explains failures.
// Also handles multi-country articles (an event spanning N countries).

import { COUNTRY_NAMES } from "./countries";

type Ring = [number, number][]; // [lng, lat]

function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const inter = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}

type Feature = { properties: { iso_a2: string }; geometry: { type: string; coordinates: unknown } };

function ringsForFeature(f: Feature): Ring[][] {
  if (f.geometry.type === "Polygon") {
    // Polygon: coordinates = Ring[] (first is outer)
    const coords = f.geometry.coordinates as Ring[];
    return [coords];
  }
  // MultiPolygon: coordinates = Ring[][][]
  const coords = f.geometry.coordinates as Ring[][][];
  // Flatten: each polygon's outer ring
  return coords.map((poly) => poly[0]).filter(Boolean) as Ring[][];
}

function outerRings(f: Feature): Ring[] {
  // Return outer ring per polygon
  if (f.geometry.type === "Polygon") {
    const coords = f.geometry.coordinates as Ring[];
    return coords.length ? [coords] as unknown as Ring[] : [];
  }
  const polys = f.geometry.coordinates as Ring[][][];
  return polys.map((poly) => poly[0]).filter(Boolean) as unknown as Ring[];
}

export function verifyLocation(args: {
  lat: number;
  lng: number;
  claimedCountryCode?: string;
  features: Feature[];
  multiCountryCodes?: string[];
}): { ok: boolean; reason: string; matchedCountry?: string; nearCountries: string[] } {
  const { lat, lng, claimedCountryCode, features, multiCountryCodes } = args;
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { ok: false, reason: "Invalid coordinates", nearCountries: [] };
  if (multiCountryCodes && multiCountryCodes.length > 1) {
    for (const code of multiCountryCodes) {
      const f = features.find((fe) => fe.properties.iso_a2 === code.toUpperCase());
      if (!f) continue;
      for (const ring of outerRings(f)) {
        if (ring.length && pointInRing(lat, lng, ring as unknown as Ring))
          return {
            ok: true,
            reason: `Inside one of ${multiCountryCodes.join(", ")}`,
            matchedCountry: code,
            nearCountries: [],
          };
      }
      void ringsForFeature(f);
    }
    return {
      ok: false,
      reason: `Coordinates not inside any of ${multiCountryCodes.join(", ")}`,
      nearCountries: multiCountryCodes,
    };
  }
  if (!claimedCountryCode)
    return { ok: true, reason: "No claimed country — accepted as world-level", nearCountries: [] };
  const f = features.find((fe) => fe.properties.iso_a2 === claimedCountryCode.toUpperCase());
  if (!f) return { ok: false, reason: `Unknown country code ${claimedCountryCode}`, nearCountries: [] };
  for (const ring of outerRings(f)) {
    if (ring.length && pointInRing(lat, lng, ring as unknown as Ring))
      return { ok: true, reason: `Inside ${claimedCountryCode}`, matchedCountry: claimedCountryCode, nearCountries: [] };
  }
  const near: string[] = [];
  for (const feat of features) {
    for (const ring of outerRings(feat)) {
      if (ring.length && pointInRing(lat, lng, ring as unknown as Ring)) {
        near.push(feat.properties.iso_a2);
        break;
      }
    }
    if (near.length >= 3) break;
  }
  const label = COUNTRY_NAMES[claimedCountryCode.toUpperCase()] ?? claimedCountryCode;
  return { ok: false, reason: `Coordinates lie outside ${label}`, matchedCountry: near[0], nearCountries: near };
}
