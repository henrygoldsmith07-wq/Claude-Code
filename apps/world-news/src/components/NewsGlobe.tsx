"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";

// react-globe.gl touches `window` on import, so it must never load during SSR.
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Loading globe…
    </div>
  ),
});

interface CountryFeature {
  properties: { name: string; iso_a2: string; iso_a3: string };
}

const OCEAN_MATERIAL = new THREE.MeshPhongMaterial({
  color: "#0d1b2e",
  emissive: "#060d17",
  shininess: 6,
});

export default function NewsGlobe() {
  const router = useRouter();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [hovered, setHovered] = useState<CountryFeature | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Countries whose Gemini summary we've already kicked off, so hovering the
  // same country (or the globe spinning past it) doesn't refire the request.
  const warmed = useRef<Set<string>>(new Set());
  // Pending debounce timer, so a quick sweep across the globe doesn't warm
  // every country the pointer grazes — only ones it rests on briefly.
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off (and cache) a country's news in the background so it's ready by
  // the time the user clicks. Hits the same cached path the page reads from.
  const warmCountry = (code: string) => {
    const key = code.toLowerCase();
    if (warmed.current.has(key)) return;
    warmed.current.add(key);
    router.prefetch(`/country/${key}`);
    fetch(`/api/country/${key}`).catch(() => {
      // Let it retry on a later hover if the prewarm request fails.
      warmed.current.delete(key);
    });
  };

  // Debounced hover: warm the country only after the pointer rests on it,
  // and cancel if it moves off first.
  const handleHover = (feat: object | null) => {
    const country = feat as CountryFeature | null;
    setHovered(country);
    if (warmTimer.current) clearTimeout(warmTimer.current);
    const code = country?.properties?.iso_a2;
    if (!code) return;
    warmTimer.current = setTimeout(() => warmCountry(code), 300);
  };

  // Load the bundled country polygons once.
  useEffect(() => {
    let active = true;
    fetch("/countries.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (active) setFeatures(data.features ?? []);
      })
      .catch(() => {
        /* leave the globe bare rather than crashing */
      });
    return () => {
      active = false;
    };
  }, []);

  // Keep the canvas sized to its container, falling back to the viewport if the
  // container ever measures zero (e.g. a collapsed flex parent) so the globe
  // never renders into a zero-height canvas.
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

  // Cancel any pending prewarm when the globe unmounts.
  useEffect(() => {
    return () => {
      if (warmTimer.current) clearTimeout(warmTimer.current);
    };
  }, []);

  // Gentle auto-rotation for the "spinning globe" feel.
  const handleReady = () => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = true;
    globe.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0);
  };

  const navigate = (feat: object | null) => {
    const country = feat as CountryFeature | null;
    const code = country?.properties?.iso_a2;
    if (code) router.push(`/country/${code.toLowerCase()}`);
  };

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
          polygonAltitude={(d: object) => (d === hovered ? 0.06 : 0.01)}
          polygonCapColor={(d: object) => (d === hovered ? "#4f8cff" : "#22406b")}
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
        />
      )}
      {hovered && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-rule bg-panel/90 px-5 py-2 text-sm font-medium backdrop-blur">
          {hovered.properties.name}{" "}
          <span className="text-muted">· click to read the news</span>
        </div>
      )}
    </div>
  );
}
