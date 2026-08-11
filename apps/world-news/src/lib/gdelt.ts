import type { NewsPoint, NewsSource } from "./gemini";
import { TOPICS } from "./gemini";

// GDELT's public GEO 2.0 API returns geolocated news as GeoJSON — free, no key,
// no real rate cap. It gives us real coordinates + article titles, which we tag
// by topic (and optionally enrich with Groq). This is what makes the streamed
// dots real current news rather than model-invented.

// Search terms per topic, used to pull topic-relevant geolocated news.
const TOPIC_QUERIES: Record<string, string> = {
  Politics: "(politics OR election OR parliament OR government OR wahlen OR élections OR política)",
  "Economy & Business": "(economy OR business OR market OR inflation OR trade OR wirtschaft OR économie)",
  "World & Conflict": "(conflict OR war OR military OR ceasefire OR troops OR guerre OR krieg OR conflicto)",
  "Science & Health": "(health OR disease OR science OR research OR hospital OR santé OR gesundheit OR salud)",
  Technology: "(technology OR software OR ai OR chip OR startup OR technologie OR tecnología)",
  "Society & Culture": "(culture OR society OR protest OR festival OR education OR cultura OR gesellschaft)",
  Sport: "(sport OR football OR olympics OR match OR championship OR fútbol OR fußball)",
};

export const GDELT_LANGUAGES: Record<string,string> = { en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano", ja: "日本語", zh: "中文", ar: "العربية", ru: "Русский", pt: "Português" };

export function gdeltQueryForLang(topic: string, lang = "en"): string {
  const base = TOPIC_QUERIES[topic] ?? "";
  if (lang === "en" || !base) return base;
  // GDELT sourcelang param does the filtering; query stays multilingual.
  return base;
}

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

// Pull the first article link out of GDELT's HTML blob (a real source URL).
function firstLink(html: string | undefined): string {
  if (!html) return "";
  const m = html.match(/href=["']([^"']+)["']/i);
  return m ? m[1] : "";
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

// Fetch real geolocated articles across every topic — worldwide, or scoped to a
// country when countryName is given (the name is added to each query). Returns
// the points (real coordinates) plus real source links. This is the grounding
// the OpenRouter organiser summarises, so the news stays real rather than
// model-invented.
export async function fetchScopeGeoNewsForLang(
  countryName: string | undefined,
  lang = "en",
  perTopic = 6,
): Promise<{ points: NewsPoint[]; sources: NewsSource[] }> {
  const points: NewsPoint[] = [];
  const sourceMap = new Map<string,string>();
  for (const topic of TOPICS) {
    const query = countryName ? `"${countryName}" ${TOPIC_QUERIES[topic] ?? topic}` : (TOPIC_QUERIES[topic] ?? topic);
    const params: Record<string,string> = { query, format: "GeoJSON", timespan: "3d", sortby: "count" };
    if (lang !== "en") params.sourcelang = lang;
    const url = "https://api.gdeltproject.org/api/v2/geo/geo?" + new URLSearchParams(params).toString();
    try {
      const res = await fetch(url, { headers: { "user-agent": "world-news-globe/1.0" }, next: { revalidate: 60*60 } } as RequestInit & { next?: { revalidate: number } });
      if (!res.ok) continue;
      const data = await res.json() as { features?: GeoFeature[] };
      let added=0;
      for (const f of Array.isArray(data.features)?data.features:[]) {
        const coords = f.geometry?.coordinates; if (!coords || coords.length<2) continue;
        const [lng,lat]=coords; if (!Number.isFinite(lat)||!Number.isFinite(lng)) continue;
        const name=(f.properties?.name??"").trim();
        const headline = firstTitle(f.properties?.html) || (name?`Reports from ${name}`:"News");
        const link = firstLink(f.properties?.html);
        points.push({ topic, headline, location: name, lat, lng, countryCode: "", tags: [lang] });
        if (link && !sourceMap.has(link)) sourceMap.set(link, headline);
        if (++added >= perTopic) break;
      }
    } catch {}
  }
  return { points: points.slice(0, 40), sources: Array.from(sourceMap, ([url,title])=> ({url,title})).slice(0,20) };
}

export async function fetchScopeGeoNews(
  countryName?: string,
  perTopic = 8,
): Promise<{ points: NewsPoint[]; sources: NewsSource[] }> {
  const points: NewsPoint[] = [];
  const sourceMap = new Map<string, string>();

  for (const topic of TOPICS) {
    const base = TOPIC_QUERIES[topic];
    if (!base) continue;
    const query = countryName ? `"${countryName}" ${base}` : base;
    const url =
      "https://api.gdeltproject.org/api/v2/geo/geo?" +
      new URLSearchParams({
        query,
        format: "GeoJSON",
        timespan: "3d",
        sortby: "count",
      }).toString();

    try {
      const res = await fetch(url, {
        headers: { "user-agent": "world-news-globe/1.0" },
        next: { revalidate: 60 * 60 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { features?: GeoFeature[] };
      let added = 0;
      for (const f of Array.isArray(data.features) ? data.features : []) {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const [lng, lat] = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const name = (f.properties?.name ?? "").trim();
        const headline =
          firstTitle(f.properties?.html) || (name ? `Reports from ${name}` : "News");
        const link = firstLink(f.properties?.html);
        points.push({ topic, headline, location: name, lat, lng, countryCode: "", tags: [] });
        if (link && !sourceMap.has(link)) sourceMap.set(link, headline);
        if (++added >= perTopic) break;
      }
    } catch {
      // Skip this topic on any failure; other topics still contribute.
    }
  }

  const sources: NewsSource[] = Array.from(sourceMap, ([url, title]) => ({ url, title })).slice(
    0,
    20,
  );
  return { points: points.slice(0, 48), sources };
}

export async function fetchMultilingualScope(countryName?: string, langs: string[] = ["en","fr","de","es"]): Promise<{ points: NewsPoint[]; sources: NewsSource[] }> {
  const all: NewsPoint[] = []; const src = new Map<string,string>();
  for (const lang of langs) {
    const { points, sources } = await fetchScopeGeoNewsForLang(countryName, lang, 4);
    all.push(...points);
    for (const s of sources) if (!src.has(s.url)) src.set(s.url, s.title);
  }
  return { points: all.slice(0, 48), sources: Array.from(src, ([url,title])=> ({url,title})).slice(0, 24) };
}
