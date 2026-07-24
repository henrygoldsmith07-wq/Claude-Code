"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GlobeMethods } from "react-globe.gl";
import type { ConflictLine, NewsPoint } from "@/lib/gemini";
import { dotColor } from "@/lib/topicColors";
import { densifyPath } from "@/lib/geo";
import ConflictMap from "@/components/ConflictMap";

// react-globe.gl touches `window` on import, so it must never load during SSR.
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Loading globe…
    </div>
  ),
});

type Ring = [number, number][]; // [lng, lat] pairs
interface CountryFeature {
  properties: { name: string; iso_a2: string; iso_a3: string };
  geometry: { type: string; coordinates: unknown };
}

// A streamed news point carries the time it appeared, so it can "pop" in.
type TimedPoint = NewsPoint & { _appeared?: number };

// How long a dot's pop-in animation runs.
const POP_MS = 620;

// Ease-out-back: grows from ~0, overshoots just past 1, then settles — a "pop".
function popScale(appeared?: number): number {
  if (!appeared) return 1;
  const t = Math.min(1, (Date.now() - appeared) / POP_MS);
  if (t >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  return Math.max(0.04, eased);
}

// Rough centroid of a GeoJSON feature: average of all its coordinate pairs.
// Good enough to point the camera at a country.
function centroidOf(feature: CountryFeature): { lat: number; lng: number } | null {
  const rings: Ring[] = [];
  const geom = feature.geometry;
  if (geom.type === "Polygon") rings.push(...(geom.coordinates as Ring[]));
  else if (geom.type === "MultiPolygon")
    for (const poly of geom.coordinates as Ring[][]) rings.push(...poly);
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const ring of rings)
    for (const [x, y] of ring) {
      lng += x;
      lat += y;
      n++;
    }
  if (!n) return null;
  return { lat: lat / n, lng: lng / n };
}

/** Rough angular distance in degrees between two lat/lng points (good enough for viewport culling). */
function angularDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = Math.abs(lat1 - lat2);
  let dlng = Math.abs(lng1 - lng2);
  if (dlng > 180) dlng = 360 - dlng;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

interface NewsGlobeProps {
  /** Carried on country clicks so the destination is topic-scoped. */
  topicSlug?: string;
  /** Restrict rendered dots to this topic (globe topic modes). */
  topicName?: string;
  /** Fetch the worldwide news points from /api/world and plot them. */
  worldPoints?: boolean;
  /** Explicit dots to plot (e.g. a single country's points). */
  points?: NewsPoint[];
  /** Explicit conflict arcs to draw. */
  arcs?: ConflictLine[];
  /** Draw conflict arcs ("war lines"). */
  showArcs?: boolean;
  /** Zoom the camera to this country's centroid on load. */
  focusCode?: string;
  /** Auto-rotate the globe (default true). */
  autoRotate?: boolean;
  /** Show a country search box that flies the camera to the picked country. */
  searchable?: boolean;
  /** When true (default for world mode), filter points to those inside the current camera viewport. */
  viewportFilter?: boolean;
}

export default function NewsGlobe({
  topicSlug,
  topicName,
  worldPoints = false,
  points,
  arcs,
  showArcs = false,
  focusCode,
  autoRotate = true,
  searchable = false,
  viewportFilter = true,
}: NewsGlobeProps = {}) {
  const router = useRouter();
  const query = topicSlug ? `?topic=${topicSlug}` : "";
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [hovered, setHovered] = useState<CountryFeature | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [fetchedPoints, setFetchedPoints] = useState<NewsPoint[]>([]);
  const [fetchedConflicts, setFetchedConflicts] = useState<ConflictLine[]>([]);
  const [streamedPoints, setStreamedPoints] = useState<TimedPoint[]>([]);
  const [, setPopTick] = useState(0);
  const [openConflict, setOpenConflict] = useState<ConflictLine | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCode, setSearchCode] = useState<string | null>(null);
  // Current camera view for viewport-scoped story filtering (Mappit-style).
  const [view, setView] = useState<{ lat: number; lng: number; altitude: number } | null>(null);

  const prefetched = useRef<Set<string>>(new Set());
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefetch only the country ROUTE (free JS/shell) on hover — never the metered
  // Gemini call, which would burn the free-tier quota.
  const handleHover = (feat: object | null) => {
    const country = feat as CountryFeature | null;
    setHovered(country);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const code = country?.properties?.iso_a2?.toLowerCase();
    if (!code || prefetched.current.has(code)) return;
    hoverTimer.current = setTimeout(() => {
      prefetched.current.add(code);
      router.prefetch(`/country/${code}${query}`);
    }, 300);
  };

  // Load the bundled country polygons once.
  useEffect(() => {
    let active = true;
    fetch("/countries.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (active) setFeatures(data.features ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch worldwide conflicts + a fallback set of points (globe modes).
  // Non-blocking: the globe renders immediately and data pops in when ready.
  useEffect(() => {
    if (!worldPoints) return;
    let active = true;
    fetch("/api/world")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setFetchedPoints(Array.isArray(data.points) ? data.points : []);
        setFetchedConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [worldPoints]);

  // Stream geolocated news dots (GDELT + Groq) so they appear on the map as
  // they're generated. Falls back to the /api/world points above if the stream
  // yields nothing (no GROQ key / source unreachable).
  useEffect(() => {
    if (!worldPoints || typeof window === "undefined" || !("EventSource" in window)) return;
    const es = new EventSource("/api/world/stream");
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "point" && msg.point) {
          // Stamp the arrival time so the dot pops in on the map.
          setStreamedPoints((prev) => [
            ...prev,
            { ...(msg.point as NewsPoint), _appeared: Date.now() },
          ]);
        } else if (msg.type === "done") {
          es.close();
        }
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [worldPoints]);

  // While any dot is still popping in, re-render each frame so the pop animates.
  useEffect(() => {
    const stillPopping = () =>
      streamedPoints.some((p) => p._appeared && Date.now() - p._appeared < POP_MS);
    if (!stillPopping()) return;
    let raf = 0;
    const loop = () => {
      setPopTick((t) => t + 1);
      if (stillPopping()) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [streamedPoints]);

  // Keep the canvas sized to its container (fall back to the viewport).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({
        width: el.clientWidth || window.innerWidth,
        height: el.clientHeight || window.innerHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (viewThrottle.current) clearTimeout(viewThrottle.current);
    };
  }, []);

  const handleReady = () => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
      addEventListener: (type: string, fn: () => void) => void;
      removeEventListener: (type: string, fn: () => void) => void;
    };
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = true;
    globe.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0);
    setReady(true);

    // Track camera for viewport-scoped filtering (stories that scope to your view).
    const updateView = () => {
      if (viewThrottle.current) return;
      viewThrottle.current = setTimeout(() => {
        viewThrottle.current = null;
        try {
          const pov = globe.pointOfView();
          if (pov && typeof pov.lat === "number") {
            setView({ lat: pov.lat, lng: pov.lng, altitude: pov.altitude ?? 2.4 });
          }
        } catch {
          /* ignore */
        }
      }, 80); // light throttle so we don't re-filter every frame
    };
    controls.addEventListener("change", updateView);
    updateView();

    // Sharpen the satellite texture at grazing angles with anisotropic
    // filtering for higher perceived definition. Best-effort: the imperative
    // material/renderer accessors aren't in every react-globe.gl version, so
    // guard and never throw (antialiasing via rendererConfig still applies).
    const g = globe as unknown as {
      globeMaterial?: () => { map?: { anisotropy: number; needsUpdate: boolean } | null };
      renderer?: () => { capabilities?: { getMaxAnisotropy?: () => number } };
    };
    const sharpen = (attempt = 0) => {
      try {
        if (typeof g.globeMaterial !== "function" || typeof g.renderer !== "function") return;
        const map = g.globeMaterial().map;
        const maxAniso = g.renderer().capabilities?.getMaxAnisotropy?.() ?? 8;
        if (map) {
          map.anisotropy = maxAniso;
          map.needsUpdate = true;
        } else if (attempt < 12) {
          setTimeout(() => sharpen(attempt + 1), 250);
        }
      } catch {
        /* accessor unavailable — rely on antialiasing */
      }
    };
    sharpen();
  };

  // Once the globe is ready and polygons are loaded, zoom to the focused country.
  useEffect(() => {
    if (!ready || !focusCode || features.length === 0) return;
    const feat = features.find(
      (f) => f.properties.iso_a2 === focusCode.toUpperCase(),
    );
    const c = feat && centroidOf(feat);
    if (c) globeRef.current?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.3 }, 800);
  }, [ready, focusCode, features]);

  const navigate = (feat: object | null) => {
    const country = feat as CountryFeature | null;
    const code = country?.properties?.iso_a2;
    if (code) router.push(`/country/${code.toLowerCase()}${query}`);
  };

  // Prefer explicit points (country map); otherwise use the streamed GDELT/Groq
  // dots, falling back to the /api/world (Gemini) points if the stream is empty.
  const worldData = streamedPoints.length > 0 ? streamedPoints : fetchedPoints;
  const basePoints = points ?? worldData;
  let shownPoints = topicName
    ? basePoints.filter((p) => p.topic === topicName)
    : basePoints;

  // Viewport-scoped filter (closest to Mappit’s “stories that scope to your view”).
  // When the user zooms or pans, only keep points that fall near the current
  // camera centre. Radius grows with altitude so a distant view still shows the world.
  if (viewportFilter && view && worldPoints && shownPoints.length > 0) {
    // At altitude ~2.5 (far) show ~110°, at ~1.0 (close) show ~35°.
    const maxDist = Math.max(25, Math.min(130, 50 + view.altitude * 28));
    shownPoints = shownPoints.filter((p) =>
      angularDist(p.lat, p.lng, view.lat, view.lng) <= maxDist,
    );
  }

  // While dots are popping in, hand the globe a fresh array each frame so it
  // re-evaluates the (time-based) radius and animates the pop.
  const anyPopping = shownPoints.some(
    (p) => (p as TimedPoint)._appeared && Date.now() - (p as TimedPoint)._appeared! < POP_MS,
  );
  const pointsForGlobe = anyPopping ? [...shownPoints] : shownPoints;
  const shownArcs = showArcs ? (arcs ?? fetchedConflicts) : [];

  // Relate news across countries: when hovering a country that has dots, tags
  // shared by its stories light up matching dots in other countries.
  const hoveredCode = hovered?.properties.iso_a2;
  const localPoints = hoveredCode
    ? shownPoints.filter((p) => p.countryCode === hoveredCode)
    : [];
  const relatedTags =
    localPoints.length > 0
      ? new Set(localPoints.flatMap((p) => p.tags))
      : null;
  // "local" = in the hovered country, "related" = elsewhere sharing a tag,
  // "dim" = unrelated (only while a country with news is hovered).
  const relationOf = (p: NewsPoint): "local" | "related" | "dim" | "none" => {
    if (!relatedTags || !hoveredCode) return "none";
    if (p.countryCode === hoveredCode) return "local";
    if (p.tags.some((t) => relatedTags.has(t))) return "related";
    return "dim";
  };
  const relatedCount = relatedTags
    ? shownPoints.filter((p) => relationOf(p) === "related").length
    : 0;

  // Breaking-news glow: cluster dots by country (or a coarse geo cell when the
  // country is unknown) so busy places get bigger dots and a pulsing ring.
  const clusterKey = (p: NewsPoint) =>
    p.countryCode || `${Math.round(p.lat)}_${Math.round(p.lng)}`;
  const clusters = new Map<string, { count: number; lat: number; lng: number; topic: string }>();
  for (const p of shownPoints) {
    const k = clusterKey(p);
    const c = clusters.get(k);
    if (c) {
      c.count++;
      c.lat += p.lat;
      c.lng += p.lng;
    } else {
      clusters.set(k, { count: 1, lat: p.lat, lng: p.lng, topic: p.topic });
    }
  }
  const clusterSize = (p: NewsPoint) => clusters.get(clusterKey(p))?.count ?? 1;
  const withAlpha = (hex: string, a: number) => {
    const m = hex.replace("#", "");
    const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
  };
  // The busiest clusters (hotspots) get an animated pulse ring on the globe.
  const rings = Array.from(clusters.values())
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => ({
      lat: c.lat / c.count,
      lng: c.lng / c.count,
      color: dotColor(c.topic),
      count: c.count,
    }));

  // Country search: match names against the loaded polygons; picking one flies
  // the camera to its centroid and highlights it.
  const q = searchQuery.trim().toLowerCase();
  const searchName = searchCode
    ? features.find((f) => f.properties.iso_a2 === searchCode)?.properties.name
    : null;
  // Show matches while typing, but not once a result is committed (query equals
  // the picked country's name), so the dropdown collapses after a selection.
  const searchResults =
    searchable && q.length > 0 && searchName?.toLowerCase() !== q
      ? features
          .filter((f) => f.properties.name.toLowerCase().includes(q))
          .slice(0, 8)
      : [];
  const selectCountry = (f: CountryFeature) => {
    const c = centroidOf(f);
    if (c) globeRef.current?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.3 }, 900);
    setSearchCode(f.properties.iso_a2);
    setSearchQuery(f.properties.name);
  };
  const isMarked = (iso: string) =>
    iso === searchCode || iso === focusCode?.toUpperCase();

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {searchable && (
        <div className="absolute left-1/2 top-3 z-30 w-72 max-w-[80vw] -translate-x-1/2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchCode(null);
            }}
            placeholder="Search a country…"
            aria-label="Search a country"
            className="w-full rounded-lg border border-rule bg-panel/90 px-3 py-2 text-sm outline-none backdrop-blur placeholder:text-muted focus:border-accent"
          />
          {searchResults.length > 0 && (
            <ul className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-rule bg-panel/95 py-1 text-sm shadow-xl backdrop-blur">
              {searchResults.map((f) => (
                <li key={f.properties.iso_a2}>
                  <button
                    type="button"
                    onClick={() => selectCountry(f)}
                    className="block w-full px-3 py-1.5 text-left hover:bg-panel-soft"
                  >
                    {f.properties.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchCode && searchName && searchResults.length === 0 && (
            <button
              type="button"
              onClick={() => router.push(`/country/${searchCode.toLowerCase()}${query}`)}
              className="mt-1 block w-full rounded-lg border border-accent/60 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/20"
            >
              Open {searchName} news →
            </button>
          )}
        </div>
      )}
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          onGlobeReady={handleReady}
          rendererConfig={{ antialias: true, powerPreference: "high-performance" }}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/textures/earth-blue-marble.jpg"
          bumpImageUrl="/textures/earth-topology.png"
          showAtmosphere
          atmosphereColor="#4f8cff"
          atmosphereAltitude={0.18}
          polygonsData={features}
          polygonAltitude={(d: object) =>
            d === hovered
              ? 0.06
              : isMarked((d as CountryFeature).properties.iso_a2)
                ? 0.03
                : 0.01
          }
          polygonCapColor={(d: object) =>
            d === hovered
              ? "rgba(79,140,255,0.55)"
              : isMarked((d as CountryFeature).properties.iso_a2)
                ? "rgba(79,140,255,0.35)"
                : "rgba(79,140,255,0.02)"
          }
          polygonSideColor={() => "rgba(79,140,255,0.15)"}
          polygonStrokeColor={() => "rgba(255,255,255,0.18)"}
          polygonLabel={(d: object) =>
            `<div style="font:600 13px sans-serif;color:#fff;background:#0e131fdd;padding:4px 8px;border-radius:6px;border:1px solid #222b3d">${
              (d as CountryFeature).properties.name
            }</div>`
          }
          onPolygonHover={handleHover}
          onPolygonClick={navigate}
          polygonsTransitionDuration={200}
          pointsData={pointsForGlobe}
          pointLat={(d: object) => (d as NewsPoint).lat}
          pointLng={(d: object) => (d as NewsPoint).lng}
          pointColor={(d: object) => {
            const rel = relationOf(d as NewsPoint);
            if (rel === "related") return "#ffffff";
            if (rel === "dim") return "rgba(147,197,253,0.22)";
            return dotColor((d as NewsPoint).topic);
          }}
          pointAltitude={(d: object) => (relationOf(d as NewsPoint) === "related" ? 0.06 : 0.03)}
          pointRadius={(d: object) => {
            const p = d as TimedPoint;
            const rel = relationOf(p);
            const base = rel === "related" ? 0.62 : rel === "local" ? 0.55 : 0.45;
            // Bigger dots where more stories cluster (breaking-news hotspots).
            const glow = Math.min(0.5, (clusterSize(p) - 1) * 0.12);
            // Pop in from ~nothing as the dot streams onto the map.
            return (base + glow) * popScale(p._appeared);
          }}
          pointsMerge={false}
          pointLabel={(d: object) => {
            const p = d as NewsPoint;
            const tags = p.tags?.length
              ? `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px">${p.tags
                  .map(
                    (t) =>
                      `<span style="font-size:10px;color:#cbd5e1;background:#1e2636;border:1px solid #2a3348;border-radius:999px;padding:1px 6px">#${t}</span>`,
                  )
                  .join("")}</div>`
              : "";
            return `<div style="max-width:230px;font:500 12px sans-serif;color:#fff;background:#0e131fee;padding:6px 9px;border-radius:8px;border:1px solid #222b3d">
              <div style="font-weight:700">${p.headline}</div>
              ${p.location ? `<div style="color:#8a94a8;margin-top:2px">${p.location}${p.topic ? " · " + p.topic : ""}</div>` : ""}
              ${tags}
            </div>`;
          }}
          pathsData={shownArcs}
          pathPoints={(d: object) => densifyPath((d as ConflictLine).path, 50)}
          pathPointLat={(p: unknown) => (p as [number, number])[0]}
          pathPointLng={(p: unknown) => (p as [number, number])[1]}
          pathColor={() => "#f87171"}
          pathStroke={1.4}
          pathPointAlt={0.012}
          pathDashLength={0.5}
          pathDashGap={0.18}
          pathDashAnimateTime={1600}
          pathTransitionDuration={0}
          onPathClick={(d: object) => setOpenConflict(d as ConflictLine)}
          pathLabel={(d: object) =>
            `<div style="font:600 12px sans-serif;color:#fecaca;background:#0e131fee;padding:5px 8px;border-radius:6px;border:1px solid #7f1d1d">⚔ ${
              (d as ConflictLine).label
            } · click to expand</div>`
          }
          ringsData={rings}
          ringLat={(d: object) => (d as { lat: number }).lat}
          ringLng={(d: object) => (d as { lng: number }).lng}
          ringColor={(d: object) => (t: number) =>
            withAlpha((d as { color: string }).color, Math.max(0, 1 - t))
          }
          ringMaxRadius={(d: object) => 2 + Math.min(4, (d as { count: number }).count)}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1400}
        />
      )}
      {hovered && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-rule bg-panel/90 px-5 py-2 text-sm font-medium backdrop-blur">
          {hovered.properties.name}{" "}
          {relatedCount > 0 ? (
            <span className="text-accent">
              · {relatedCount} related {relatedCount === 1 ? "story" : "stories"} elsewhere
            </span>
          ) : (
            <span className="text-muted">· click to read the news</span>
          )}
        </div>
      )}
      {openConflict && (
        <ConflictMap
          conflict={openConflict}
          features={features}
          onClose={() => setOpenConflict(null)}
        />
      )}
    </div>
  );
}
