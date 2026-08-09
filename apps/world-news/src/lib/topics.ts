import { TOPICS, type Topic } from "./gemini";

// URL-safe slug for each topic, used by the per-topic globe pages
// (/topic/<slug>) and the ?topic=<slug> filter on country pages.
export const TOPIC_SLUGS: Record<Topic, string> = {
  Politics: "politics",
  "Economy & Business": "economy",
  "World & Conflict": "world-conflict",
  "Science & Health": "science-health",
  Technology: "technology",
  "Society & Culture": "society",
  Sport: "sport",
};

// A short emoji per topic for the globe/menu chips.
export const TOPIC_EMOJI: Record<Topic, string> = {
  Politics: "🏛️",
  "Economy & Business": "💹",
  "World & Conflict": "🌐",
  "Science & Health": "🔬",
  Technology: "💻",
  "Society & Culture": "🎭",
  Sport: "🏅",
};

// Topics paired with their slug, in canonical order — handy for menus.
export const TOPIC_LINKS = TOPICS.map((topic) => ({
  topic,
  slug: TOPIC_SLUGS[topic],
  emoji: TOPIC_EMOJI[topic],
}));

// Resolve a URL slug back to its canonical topic name, or null if unknown.
export function getTopicBySlug(slug: string): Topic | null {
  const wanted = slug.trim().toLowerCase();
  return TOPICS.find((t) => TOPIC_SLUGS[t] === wanted) ?? null;
}
