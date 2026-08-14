// Geographic representation of events.
//
// A globe wants one dot per story. Most stories do not have one location:
// a Red Sea shipping attack has a strike point, a diversion at Rotterdam and a
// price move in Singapore, and pinning it to a single coordinate throws away
// most of what happened. This module models an event's geography as a set of
// loci with roles and confidences, and gives the map layer something honest to
// draw — including "we don't know where this is", which is a real answer.

import { regionOf, type Region } from "./coverageBias";

export type LocusRole =
  | "primary"     // where the event happened
  | "secondary"   // other places directly involved
  | "reaction"    // where the response or consequence is
  | "reported-from"; // dateline only — the outlet, not the event

export interface Locus {
  label: string;
  lat: number;
  lng: number;
  countryCode?: string;
  role: LocusRole;
  /** 0..100 with reasons — never a bare number on the map. */
  confidence: number;
  reasons: string[];
}

export interface EventGeography {
  loci: Locus[];
  /** The point to draw when only one can be drawn. Null when nothing is placeable. */
  focus: Locus | null;
  /** Set when the event is genuinely regional rather than point-located. */
  regionLabel: string | null;
  regions: Region[];
  countryCodes: string[];
  /** True when the event spans places far enough apart that one dot misleads. */
  multiLocation: boolean;
  /** What the map should do with this. */
  render: "point" | "multi-point" | "region" | "unplaced";
  note: string;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export interface GeocodeEvidence {
  hasCoords: boolean;
  /** Independent sources naming this place. */
  sourceCount: number;
  countryCode?: string;
  /** Geocoder returned more than one plausible match. */
  ambiguousMatches: number;
  /** Coordinates verified to fall inside the claimed country polygon. */
  insideClaimedCountry?: boolean;
  /** The place name is a country or region rather than a settlement. */
  isAdminArea?: boolean;
}

/**
 * Score how confident we are in a location, with the reasons attached.
 *
 * The ambiguity penalty is the one that matters: there are around forty places
 * called Springfield, and a geocoder returning several matches is telling us it
 * guessed. A number without that context invites the map to draw a firm dot on
 * a coin flip.
 */
export function locationConfidence(ev: GeocodeEvidence): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 35;

  if (ev.hasCoords) { score += 25; reasons.push("Coordinates supplied by the source"); }
  else reasons.push("No coordinates — position inferred from the place name");

  if (ev.countryCode) { score += 12; reasons.push(`Country identified (${ev.countryCode})`); }
  if (ev.insideClaimedCountry === true) { score += 15; reasons.push("Coordinates verified inside the named country"); }
  else if (ev.insideClaimedCountry === false) { score -= 35; reasons.push("Coordinates fall outside the named country"); }

  if (ev.sourceCount >= 3) { score += 12; reasons.push(`${ev.sourceCount} sources name this place`); }
  else if (ev.sourceCount === 1) { score -= 8; reasons.push("Only one source names this place"); }

  if (ev.ambiguousMatches > 1) {
    score -= Math.min(28, ev.ambiguousMatches * 9);
    reasons.push(`${ev.ambiguousMatches} places share this name — match is uncertain`);
  }
  if (ev.isAdminArea) {
    score -= 10;
    reasons.push("Name refers to a country or region, not a specific place");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4) };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

/** Named groupings a reader recognises, checked before falling back to a list. */
const REGION_GROUPS: { label: string; codes: string[]; minMatch: number }[] = [
  { label: "the Baltic states", codes: ["EE", "LV", "LT"], minMatch: 2 },
  { label: "the Nordic countries", codes: ["SE", "NO", "DK", "FI", "IS"], minMatch: 2 },
  { label: "the Benelux", codes: ["BE", "NL", "LU"], minMatch: 2 },
  { label: "the Western Balkans", codes: ["RS", "BA", "ME", "MK", "AL", "XK"], minMatch: 2 },
  { label: "the Gulf states", codes: ["SA", "AE", "QA", "KW", "BH", "OM"], minMatch: 2 },
  { label: "the Levant", codes: ["LB", "SY", "JO", "IL", "PS"], minMatch: 2 },
  { label: "the Sahel", codes: ["ML", "NE", "BF", "TD", "MR", "SD"], minMatch: 2 },
  { label: "the Horn of Africa", codes: ["ET", "SO", "ER", "DJ", "SS"], minMatch: 2 },
  { label: "the Maghreb", codes: ["MA", "DZ", "TN", "LY"], minMatch: 2 },
  { label: "East Africa", codes: ["KE", "TZ", "UG", "RW", "BI"], minMatch: 2 },
  { label: "West Africa", codes: ["NG", "GH", "SN", "CI", "BJ", "TG"], minMatch: 2 },
  { label: "Southern Africa", codes: ["ZA", "ZW", "ZM", "BW", "NA", "MZ"], minMatch: 2 },
  { label: "the Iberian peninsula", codes: ["ES", "PT"], minMatch: 2 },
  { label: "the Korean peninsula", codes: ["KR", "KP"], minMatch: 2 },
  { label: "the Mekong region", codes: ["VN", "TH", "LA", "KH", "MM"], minMatch: 2 },
  { label: "the Southern Cone", codes: ["AR", "CL", "UY", "PY"], minMatch: 2 },
  { label: "Central America", codes: ["GT", "HN", "SV", "NI", "CR", "PA"], minMatch: 2 },
  { label: "North America", codes: ["US", "CA", "MX"], minMatch: 3 },
  { label: "the Pacific islands", codes: ["FJ", "PG", "SB", "VU", "WS", "TO"], minMatch: 2 },
];

/**
 * Name a group of countries the way a person would.
 *
 * "the Baltic states" is a better label than "EE, LV, LT" because it is what
 * the story itself will have called them. Falls back to listing when no group
 * fits — an invented regional name would be worse than a list.
 */
export function regionalLabel(countryCodes: string[]): string | null {
  const codes = [...new Set(countryCodes.map((c) => c.toUpperCase()).filter(Boolean))];
  if (codes.length <= 1) return null;

  let best: { label: string; matched: number } | null = null;
  for (const group of REGION_GROUPS) {
    const matched = codes.filter((c) => group.codes.includes(c)).length;
    if (matched < group.minMatch) continue;
    // Prefer the group that covers the most of what we actually have.
    if (!best || matched > best.matched) best = { label: group.label, matched };
  }
  // Only use a group name when it accounts for most of the countries present.
  if (best && best.matched >= Math.ceil(codes.length * 0.6)) return best.label;

  const regions = [...new Set(codes.map((c) => regionOf(c)).filter((r) => r !== "Unknown"))];
  if (regions.length === 1) return regions[0];
  return `across ${codes.slice(0, 3).join(", ")}${codes.length > 3 ? ` and ${codes.length - 3} more` : ""}`;
}

// ---------------------------------------------------------------------------
// Event geography
// ---------------------------------------------------------------------------

/** Above this spread, one dot is a misrepresentation rather than a simplification. */
export const MULTI_LOCATION_KM = 600;

/**
 * Build the geographic view of an event from its loci.
 *
 * The focus point is the highest-confidence primary locus, not a centroid:
 * averaging Rotterdam and Singapore puts the dot in the Indian Ocean, where
 * nothing happened. When loci are spread, the answer is several dots or a
 * region — never a confident dot in an average position.
 */
export function eventGeography(loci: Locus[]): EventGeography {
  const placeable = loci.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));
  const countryCodes = [...new Set(placeable.map((l) => l.countryCode).filter((c): c is string => Boolean(c)))];
  const regions = [...new Set(countryCodes.map(regionOf).filter((r) => r !== "Unknown"))];

  if (placeable.length === 0) {
    return {
      loci, focus: null, regionLabel: null, regions, countryCodes,
      multiLocation: false, render: "unplaced",
      note: "No location could be established for this story — it is listed but not mapped.",
    };
  }

  const byPriority: Record<LocusRole, number> = { primary: 0, secondary: 1, reaction: 2, "reported-from": 3 };
  const ranked = [...placeable].sort(
    (a, b) => byPriority[a.role] - byPriority[b.role] || b.confidence - a.confidence,
  );
  const focus = ranked[0];

  let maxSpread = 0;
  for (let i = 0; i < placeable.length; i++) {
    for (let j = i + 1; j < placeable.length; j++) {
      maxSpread = Math.max(maxSpread, haversineKm(placeable[i].lat, placeable[i].lng, placeable[j].lat, placeable[j].lng));
    }
  }
  // Country count is the stronger signal: three capitals 500km apart is still a
  // regional story, and one dot on Tallinn misrepresents a Baltic-wide event.
  const multiLocation = maxSpread > MULTI_LOCATION_KM || countryCodes.length >= 3;
  const label = regionalLabel(countryCodes);

  // A spread across several countries with no dominant point is a region, not
  // a set of points — drawing five dots implies five discrete happenings.
  const dominant = ranked.filter((l) => l.role === "primary").length;
  const render: EventGeography["render"] =
    !multiLocation ? "point"
      : countryCodes.length >= 3 && dominant !== 1 ? "region"
        : "multi-point";

  const note =
    render === "point"
      ? `Located at ${focus.label} (confidence ${focus.confidence}%).`
      : render === "multi-point"
        ? `Spans ${placeable.length} places up to ${Math.round(maxSpread)}km apart — shown as separate points.`
        : `Regional story covering ${label ?? countryCodes.join(", ")} — shown as an area, not a point.`;

  return { loci, focus, regionLabel: label, regions, countryCodes, multiLocation, render, note };
}

/**
 * Grid-bin points for low-power rendering.
 *
 * Returns bins with their member count so the renderer can size a marker
 * instead of drawing every point — the difference between a usable map and a
 * stalled one on a mid-range phone.
 */
export function binPoints(
  pts: { lat: number; lng: number }[],
  cellDeg = 4,
): { lat: number; lng: number; count: number }[] {
  const m = new Map<string, { lat: number; lng: number; count: number }>();
  for (const p of pts) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const key = `${Math.round(p.lat / cellDeg)}:${Math.round(p.lng / cellDeg)}`;
    const cur = m.get(key);
    if (cur) {
      cur.lat = (cur.lat * cur.count + p.lat) / (cur.count + 1);
      cur.lng = (cur.lng * cur.count + p.lng) / (cur.count + 1);
      cur.count++;
    } else {
      m.set(key, { lat: p.lat, lng: p.lng, count: 1 });
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

/**
 * How many points to draw for a given device budget.
 *
 * Low-power devices get fewer, larger bins rather than a decimated sample:
 * dropping points silently removes stories from the map, while coarser bins
 * keep every story represented inside a marker the reader can open.
 */
export function renderBudget(tier: "low" | "medium" | "high"): { maxPoints: number; cellDeg: number; animate: boolean } {
  switch (tier) {
    case "low": return { maxPoints: 120, cellDeg: 12, animate: false };
    case "medium": return { maxPoints: 400, cellDeg: 6, animate: true };
    case "high": return { maxPoints: 2000, cellDeg: 3, animate: true };
  }
}
