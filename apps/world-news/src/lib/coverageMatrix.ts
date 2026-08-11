// Coverage-gap detection: compare coverage across countries/publications.
// Produces a country × publication matrix + gap list.

import type { CountryNews } from "./gemini";
import type { SourceAttribution } from "./storyModel";

export interface CoverageCell { count: number; headlines: string[]; }
export type CoverageMatrix = Map<string, Map<string, CoverageCell>>; // country -> publisher -> cell

export function buildCoverageMatrix(newsList: CountryNews[]): CoverageMatrix {
  const m: CoverageMatrix = new Map();
  for (const news of newsList) for (const s of news.stories ?? []) for (const src of s.sources) {
    const cc = src.countryCode ?? "unknown";
    const pub = src.publisher ?? new URL(src.url).hostname.replace(/^www\./,"");
    if (!m.has(cc)) m.set(cc, new Map());
    const row = m.get(cc)!;
    const cell = row.get(pub) ?? { count: 0, headlines: [] };
    cell.count++;
    if (cell.headlines.length < 4) cell.headlines.push(s.headline.slice(0, 80));
    row.set(pub, cell);
  }
  return m;
}

export interface Gap { kind: "country" | "publisher" | "topic"; key: string; reason: string; }

export function detectGaps(newsList: CountryNews[], allTopics: string[]): Gap[] {
  const gaps: Gap[] = [];
  const countryCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  let totalStories = 0;
  for (const news of newsList) for (const s of news.stories ?? []) {
    totalStories++;
    const cc = s.location?.countryCode ?? s.sources[0]?.countryCode ?? "unknown";
    countryCounts.set(cc, (countryCounts.get(cc)??0)+1);
    topicCounts.set(s.topic, (topicCounts.get(s.topic)??0)+1);
  }
  // Under-covered topics
  for (const t of allTopics) {
    const n = topicCounts.get(t) ?? 0;
    if (totalStories > 0 && n/totalStories < 0.05) gaps.push({ kind: "topic", key: t, reason: `Only ${n} stories in ${t} — under-represented` });
  }
  // Sparse countries
  for (const [cc, n] of countryCounts) {
    if (cc !== "unknown" && n === 1) gaps.push({ kind: "country", key: cc, reason: `Single story from ${cc} — local reporting thin` });
  }
  return gaps.slice(0, 12);
}
