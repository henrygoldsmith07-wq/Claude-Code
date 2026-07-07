import bcrypt from "bcryptjs";
import { getDb } from "./client";

export async function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.password || params.password.length < 6) {
    throw new Error("A valid email and a password of at least 6 characters are required.");
  }

  const db = await getDb();
  const users = db.collection("users");
  const existing = await users.findOne({ email });
  if (existing) throw new Error("An account with that email already exists.");

  const passwordHash = await bcrypt.hash(params.password, 10);
  const username = params.displayName.trim() || email.split("@")[0];
  const now = new Date().toISOString();

  const userInsert = await users.insertOne({ email, passwordHash, name: username, created_at: now });

  await db.collection("profiles").insertOne({
    _id: userInsert.insertedId,
    username,
    total_points: 0,
    level: 1,
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null,
    created_at: now,
  });
}
