"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import type { ConflictLine, NewsPoint } from "@/lib/gemini";
import { dotColor } from "@/lib/topicColors";
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

const OCEAN_MATERIAL = new THREE.MeshPhongMaterial({
  color: "#0d1b2e",
  emissive: "#060d17",
  shininess: 6,
});

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
  const [streamedPoints, setStreamedPoints] = useState<NewsPoint[]>([]);
  const [openConflict, setOpenConflict] = useState<ConflictLine | null>(null);

  const prefetched = useRef<Set<string>>(new Set());
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setStreamedPoints((prev) => [...prev, msg.point as NewsPoint]);
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
    };
  }, []);

  const handleReady = () => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
    };
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = true;
    globe.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0);
    setReady(true);
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
  const shownPoints = topicName
    ? basePoints.filter((p) => p.topic === topicName)
    : basePoints;
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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          onGlobeReady={handleReady}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={OCEAN_MATERIAL}
          showAtmosphere
          atmosphereColor="#4f8cff"
          atmosphereAltitude={0.18}
          polygonsData={features}
          polygonAltitude={(d: object) =>
            d === hovered
              ? 0.06
              : (d as CountryFeature).properties.iso_a2 === focusCode?.toUpperCase()
                ? 0.03
                : 0.01
          }
          polygonCapColor={(d: object) =>
            d === hovered
              ? "#4f8cff"
              : (d as CountryFeature).properties.iso_a2 === focusCode?.toUpperCase()
                ? "#2f5fae"
                : "#22406b"
          }
          polygonSideColor={() => "rgba(79,140,255,0.15)"}
          polygonStrokeColor={() => "#0a1524"}
          polygonLabel={(d: object) =>
            `<div style="font:600 13px sans-serif;color:#fff;background:#0e131fdd;padding:4px 8px;border-radius:6px;border:1px solid #222b3d">${
              (d as CountryFeature).properties.name
            }</div>`
          }
          onPolygonHover={handleHover}
          onPolygonClick={navigate}
          polygonsTransitionDuration={200}
          pointsData={shownPoints}
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
            const rel = relationOf(d as NewsPoint);
            return rel === "related" ? 0.62 : rel === "local" ? 0.55 : 0.45;
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
          pathPoints={(d: object) => (d as ConflictLine).path}
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
