// Live event overlays (Mappit-style: earthquakes, etc.)
// Uses the public USGS GeoJSON feed — no API key required.

export interface LiveEvent {
  id: string;
  lat: number;
  lng: number;
  label: string;
  detail: string;
  magnitude?: number;
  color: string;
}

interface UsgsFeature {
  id: string;
  properties: {
    mag?: number;
    place?: string;
    time?: number;
    title?: string;
  };
  geometry?: {
    coordinates?: [number, number, number];
  };
}

/** Fetch significant earthquakes from the last day (public USGS feed). */
export async function fetchEarthquakes(): Promise<LiveEvent[]> {
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
      { next: { revalidate: 300 } }, // cache ~5 min if called from server
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: UsgsFeature[] };
    const features = Array.isArray(data.features) ? data.features : [];
    return features
      .slice(0, 40)
      .map((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const [lng, lat] = coords;
        const mag = f.properties.mag ?? 0;
        return {
          id: f.id,
          lat,
          lng,
          label: f.properties.title || `M${mag.toFixed(1)} earthquake`,
          detail: f.properties.place || "",
          magnitude: mag,
          color: mag >= 5 ? "#ef4444" : mag >= 4 ? "#f97316" : "#fbbf24",
        } as LiveEvent;
      })
      .filter((e): e is LiveEvent => Boolean(e));
  } catch {
    return [];
  }
}
