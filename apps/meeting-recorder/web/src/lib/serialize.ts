import { WithId } from "mongodb";
import type { MeetingDoc } from "./mongodb";
import type { Meeting } from "./types";

/** Convert a Mongo document into the JSON-safe shape the client consumes. */
export function toMeeting(doc: WithId<MeetingDoc>): Meeting {
  return {
    id: doc._id.toString(),
    title: doc.title,
    status: doc.status as Meeting["status"],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    durationSec: doc.durationSec,
    r2Key: doc.r2Key,
    mimeType: doc.mimeType,
    shareId: doc.shareId,
    transcript: doc.transcript,
    summary: doc.summary,
    error: doc.error,
  };
}
