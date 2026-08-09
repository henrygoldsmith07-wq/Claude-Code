import { ObjectId, WithId } from "mongodb";
import { getMeetings, MeetingDoc } from "./mongodb";
import { playbackUrl } from "./r2";
import { toMeeting } from "./serialize";
import type { Meeting, ChatMessage } from "./types";

export interface LoadedMeeting {
  meeting: Meeting;
  playbackUrl: string | null;
  chat: ChatMessage[];
}

async function build(doc: WithId<MeetingDoc> | null): Promise<LoadedMeeting | null> {
  if (!doc) return null;
  const meeting = toMeeting(doc);
  const url = doc.status === "created" ? null : await playbackUrl(doc.r2Key).catch(() => null);
  const chat: ChatMessage[] = (doc.chat ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
  return { meeting, playbackUrl: url, chat };
}

/** Server-side loader for the authenticated meeting detail page. */
export async function loadMeetingById(id: string): Promise<LoadedMeeting | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getMeetings();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return build(doc);
}

/** Server-side loader for the public share page. */
export async function loadMeetingByShareId(shareId: string): Promise<LoadedMeeting | null> {
  const col = await getMeetings();
  const doc = await col.findOne({ shareId });
  return build(doc);
}
