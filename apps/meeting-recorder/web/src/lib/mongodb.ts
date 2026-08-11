import { MongoClient, Db, Collection } from "mongodb";
import { required, optional } from "./env";

/**
 * Cached Mongo connection. Next.js route handlers run in a long-lived server
 * process (and Vercel keeps warm lambdas), so we memoise the client on the
 * global object to avoid exhausting the connection pool on hot reload.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function clientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const uri = required("MONGODB_URI");
    const client = new MongoClient(uri, { maxPoolSize: 10 });
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(optional("MONGODB_DB", "meeting_recorder"));
}

export interface MeetingDoc {
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  durationSec: number;
  r2Key: string;
  mimeType: string;
  shareId: string;
  transcript: {
    language?: string;
    text: string;
    segments: { start: number; end: number; text: string }[];
    words?: { word: string; start: number; end: number; confidence: number }[];
  } | null;
  summary: string | null;
  error: string | null;
  chat: { role: "user" | "assistant"; content: string; createdAt: Date }[];
  // 9+ additions — all optional for backward compat
  templateId?: string | null;
  recurringKey?: string | null;
  insights?: { decisions: { id: string; text: string; evidence: { segmentIndex: number; start: number; text: string }[]; claimTimestamp?: string | null }[]; actions: { id: string; text: string; owner: string | null; ownerEvidence: { segmentIndex: number; start: number; text: string } | null; evidence: { segmentIndex: number; start: number; text: string }[]; due?: { raw: string; normalized: string | null; evidence: { segmentIndex: number; start: number; text: string } } | null; dueHint?: string | null; claimTimestamp?: string | null }[]; generatedAt?: string } | null;
  speakers?: Record<string,string> | null;
  speakerEnrolment?: { id: string; name: string; sampleText?: string }[] | null;
  transcriptHistory?: { at: string; segmentIndex: number; before: string; after: string }[] | null;
  retentionDays?: number | null;
  workspaceId?: string | null;
  collections?: string[] | null;
}


let indexesEnsured = false;

export async function getMeetings(): Promise<Collection<MeetingDoc>> {
  const db = await getDb();
  const col = db.collection<MeetingDoc>("meetings");
  if (!indexesEnsured) {
    await Promise.all([
      col.createIndex({ shareId: 1 }, { unique: true }),
      col.createIndex({ createdAt: -1 }),
      col.createIndex({ recurringKey: 1 }),
      col.createIndex({ workspaceId: 1 }),
    ]);
    indexesEnsured = true;
  }
  return col;
}
