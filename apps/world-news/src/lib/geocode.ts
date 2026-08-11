// Better geocoding: confidence, multi-location stories, regional events.
// Uses Nominatim when a place has no coords; caches briefly.

export interface Geocoded { label: string; lat: number; lng: number; countryCode?: string; confidence: number; alternatives?: { label: string; lat: number; lng: number }[]; }

const CACHE = new Map<string, Geocoded>();
const TTL_MS = 12*60*60*1000;
const atCache = new Map<string, number>();

function keyFor(label: string): string { return label.trim().toLowerCase(); }

export async function geocode(label: string): Promise<Geocoded | null> {
  const k = keyFor(label);
  const hit = CACHE.get(k);
  if (hit && (Date.now() - (atCache.get(k) ?? 0) < TTL_MS)) return hit;
  // Offline/lite guard: if label already has coords upstream, caller shouldn't call this.
  // Network fetch is best-effort; failures return null.
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(label)}&addressdetails=1`;
    const res = await fetch(url, { headers: { "user-agent": "world-news-geocode/1.0" }, next: { revalidate: 3600 } } as RequestInit & { next?: { revalidate: number } });
    if (!res.ok) return null;
    const rows = await res.json() as { lat: string; lon: string; display_name: string; address?: { country_code?: string } }[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const first = rows[0];
    const conf = rows.length === 1 ? 85 : 60;
    const g: Geocoded = {
      label: first.display_name?.split(",").slice(0,2).join(", ") ?? label,
      lat: Number(first.lat), lng: Number(first.lon),
      countryCode: first.address?.country_code?.toUpperCase(),
      confidence: conf,
      alternatives: rows.slice(1,3).map(r=> ({ label: r.display_name?.split(",").slice(0,2).join(", ") ?? label, lat: Number(r.lat), lng: Number(r.lon) })),
    };
    if (!Number.isFinite(g.lat) || !Number.isFinite(g.lng)) return null;
    CACHE.set(k, g); atCache.set(k, Date.now());
    return g;
  } catch { return null; }
}

export function locationConfidence(args: { hasCoords: boolean; sourceCount: number; countryCode?: string; hasAlternatives: boolean }): number {
  let s = 40;
  if (args.hasCoords) s += 30;
  if (args.countryCode) s += 15;
  if (args.sourceCount >= 3) s += 10;
  if (args.hasAlternatives) s -= 12;
  if (args.sourceCount === 1) s -= 10;
  return Math.max(0, Math.min(100, s));
}

export function regionalLabel(countryCodes: string[]): string | null {
  if (countryCodes.length <= 1) return null;
  const set = new Set(countryCodes);
  if (set.has("FR") && set.has("DE") && set.has("IT")) return "Western Europe";
  if (set.has("US") && set.has("CA") && set.has("MX")) return "North America";
  if (set.has("SA") && set.has("AE") && set.has("QA")) return "Gulf region";
  if (set.has("CN") && set.has("JP") && set.has("KR")) return "East Asia";
  if (set.has("NG") && set.has("ZA") && set.has("KE")) return "Sub-Saharan Africa";
  return `Across ${countryCodes.slice(0,3).join(", ")}`;
}

export function mapCluster(pts: { lat: number; lng: number }[], cellDeg = 4): Map<string, { lat: number; lng: number; count: number }> {
  const m = new Map<string, { lat: number; lng: number; count: number }>();
  for (const p of pts) {
    const k = `${Math.round(p.lat/cellDeg)*cellDeg}:${Math.round(p.lng/cellDeg)*cellDeg}`;
    const cur = m.get(k);
    if (cur) { cur.lat = (cur.lat*cur.count + p.lat)/(cur.count+1); cur.lng = (cur.lng*cur.count + p.lng)/(cur.count+1); cur.count++; }
    else m.set(k, { lat: p.lat, lng: p.lng, count: 1 });
  }
  return m;
}
