import { getDatabase } from '../src/server/database.js';
import * as initial from './migrations/001-initial-backend.mjs';

const migrations = [initial];
const db = await getDatabase();
const applied = new Set((await db.collection('migrations').find({}, { projection: { _id: 1 } }).toArray())
  .map((migration) => migration._id));

for (const migration of migrations) {
  if (applied.has(migration.id)) continue;
  await migration.up(db);
  await db.collection('migrations').insertOne({ _id: migration.id, appliedAt: new Date() });
  console.log(`Applied ${migration.id}`);
}

console.log('Database migrations are current.');
process.exit(0);
