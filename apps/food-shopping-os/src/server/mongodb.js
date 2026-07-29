import { MongoClient, ServerApiVersion } from 'mongodb';

let client;
let connection;

export const databaseName = process.env.MONGODB_DB || 'forq';

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  if (!client) {
    client = new MongoClient(uri, {
      appName: 'forq',
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    connection = client.connect();
  }
  return connection;
}

export async function getDatabase() {
  return (await getMongoClient()).db(databaseName);
}

export const mongoClientPromise = process.env.MONGODB_URI ? getMongoClient() : null;
