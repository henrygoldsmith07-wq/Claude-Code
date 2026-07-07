import { MongoClient, type Db } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME || "daily-debate";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  return new MongoClient(uri).connect();
}

// Cached across module reloads in dev (HMR) and across warm invocations in
// production, so we don't open a new connection per request.
function getClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connect();
  }
  return global._mongoClientPromise;
}

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("daily_topics").createIndex({ topic_date: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("solo_debates").createIndex({ user_id: 1, topic_id: 1, status: 1 }),
    db.collection("solo_debate_turns").createIndex({ debate_id: 1, round_number: 1 }),
    db.collection("profiles").createIndex({ total_points: -1 }),
  ]);
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(dbName);
  if (!indexesReady) indexesReady = ensureIndexes(db);
  await indexesReady;
  return db;
}
