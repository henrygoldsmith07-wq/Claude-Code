import type { NewsPoint } from "./gemini";
import { TOPICS } from "./gemini";

// GDELT's public GEO 2.0 API returns geolocated news as GeoJSON — free, no key,
// no real rate cap. It gives us real coordinates + article titles, which we tag
// by topic (and optionally enrich with Groq). This is what makes the streamed
// dots real current news rather than model-invented.

// Search terms per topic, used to pull topic-relevant geolocated news.
const TOPIC_QUERIES: Record<string, string> = {
  Politics: "(politics OR election OR parliament OR government)",
  "Economy & Business": "(economy OR business OR market OR inflation OR trade)",
  "World & Conflict": "(conflict OR war OR military OR ceasefire OR troops)",
  "Science & Health": "(health OR disease OR science OR research OR hospital)",
  Technology: "(technology OR software OR ai OR chip OR startup)",
  "Society & Culture": "(culture OR society OR protest OR festival OR education)",
  Sport: "(sport OR football OR olympics OR match OR championship)",
};

interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; count?: number; html?: string };
}

// Pull the first article title out of GDELT's HTML blob for a point.
function firstTitle(html: string | undefined): string {
  if (!html) return "";
  const m = html.match(/<a[^>]*>([^<]+)<\/a>/i);
  return m ? m[1].trim() : "";
}

// Fetch geolocated news points for one topic. Never throws — returns [] on any
// failure so the stream can continue with the other topics.
export async function fetchTopicGeoNews(
  topic: string,
  timespanDays = 3,
  max = 12,
): Promise<NewsPoint[]> {
  const query = TOPIC_QUERIES[topic];
  if (!query) return [];
  const url =
    "https://api.gdeltproject.org/api/v2/geo/geo?" +
    new URLSearchParams({
      query,
      format: "GeoJSON",
      timespan: `${timespanDays}d`,
      sortby: "count",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "world-news-globe/1.0" },
      // GDELT data doesn't change second-to-second; let the platform cache it.
      next: { revalidate: 60 * 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: GeoFeature[] };
    const features = Array.isArray(data.features) ? data.features : [];
    const points: NewsPoint[] = [];
    for (const f of features) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const name = (f.properties?.name ?? "").trim();
      const headline = firstTitle(f.properties?.html) || (name ? `Reports from ${name}` : "News");
      points.push({
        topic,
        headline,
        location: name,
        lat,
        lng,
        countryCode: "",
        tags: [],
      });
      if (points.length >= max) break;
    }
    return points;
  } catch {
    return [];
  }
}

// All topics, in canonical order.
export const GDELT_TOPICS = TOPICS as readonly string[];
