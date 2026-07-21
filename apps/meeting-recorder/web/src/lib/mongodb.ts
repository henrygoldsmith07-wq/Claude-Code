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
  } | null;
  summary: string | null;
  error: string | null;
  chat: { role: "user" | "assistant"; content: string; createdAt: Date }[];
}

let indexesEnsured = false;

export async function getMeetings(): Promise<Collection<MeetingDoc>> {
  const db = await getDb();
  const col = db.collection<MeetingDoc>("meetings");
  if (!indexesEnsured) {
    // shareId lookups on the public route; createdAt for dashboard ordering.
    await Promise.all([
      col.createIndex({ shareId: 1 }, { unique: true }),
      col.createIndex({ createdAt: -1 }),
    ]);
    indexesEnsured = true;
  }
  return col;
}
