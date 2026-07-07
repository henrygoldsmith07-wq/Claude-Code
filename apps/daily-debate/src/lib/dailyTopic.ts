import { getDb } from "./db/client";
import { serializeTopic } from "./db/serialize";
import { generateDailyTopic } from "./gemini";
import type { DailyTopic } from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns today's topic, generating and persisting one via Gemini the first
// time it's requested each day.
export async function getOrCreateTodayTopic(): Promise<DailyTopic> {
  const db = await getDb();
  const topics = db.collection("daily_topics");
  const date = todayIso();

  const existing = await topics.findOne({ topic_date: date });
  if (existing) return serializeTopic(existing);

  const recent = await topics
    .find({}, { projection: { title: 1 } })
    .sort({ topic_date: -1 })
    .limit(14)
    .toArray();

  const generated = await generateDailyTopic(recent.map((row) => row.title as string));

  try {
    const inserted = await topics.insertOne({
      topic_date: date,
      title: generated.title,
      prompt: generated.prompt,
      category: generated.category,
      sources: generated.sources,
      created_at: new Date().toISOString(),
    });
    const doc = await topics.findOne({ _id: inserted.insertedId });
    if (doc) return serializeTopic(doc);
    throw new Error("Failed to load newly created topic.");
  } catch (error) {
    // Another request may have generated the topic concurrently — the
    // unique index on topic_date rejects our insert, so fall back to reading.
    const fallback = await topics.findOne({ topic_date: date });
    if (fallback) return serializeTopic(fallback);
    throw error;
  }
}
