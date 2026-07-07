import type { Document, ObjectId, WithId } from "mongodb";
import type { DailyTopic, Profile, SoloDebate, SoloDebateTurn } from "@/lib/types";

function oid(id: ObjectId | string): string {
  return typeof id === "string" ? id : id.toString();
}

export function serializeTopic(doc: WithId<Document>): DailyTopic {
  return {
    id: oid(doc._id),
    topic_date: doc.topic_date,
    title: doc.title,
    prompt: doc.prompt,
    category: doc.category ?? null,
    sources: doc.sources ?? [],
    created_at: doc.created_at,
  };
}

export function serializeProfile(doc: WithId<Document>): Profile {
  return {
    id: oid(doc._id),
    username: doc.username ?? null,
    total_points: doc.total_points,
    level: doc.level,
    current_streak: doc.current_streak,
    longest_streak: doc.longest_streak,
    last_activity_date: doc.last_activity_date ?? null,
    created_at: doc.created_at,
  };
}

export function serializeDebate(doc: WithId<Document>): SoloDebate {
  return {
    id: oid(doc._id),
    user_id: oid(doc.user_id),
    topic_id: oid(doc.topic_id),
    side: doc.side,
    status: doc.status,
    round_count: doc.round_count,
    total_score: doc.total_score ?? null,
    created_at: doc.created_at,
    completed_at: doc.completed_at ?? null,
  };
}

export function serializeTurn(doc: WithId<Document>): SoloDebateTurn {
  return {
    id: oid(doc._id),
    debate_id: oid(doc.debate_id),
    round_number: doc.round_number,
    ai_message: doc.ai_message,
    user_message: doc.user_message ?? null,
    input_mode: doc.input_mode,
    scores: doc.scores ?? null,
    turn_score: doc.turn_score ?? null,
    feedback: doc.feedback ?? null,
    created_at: doc.created_at,
  };
}
