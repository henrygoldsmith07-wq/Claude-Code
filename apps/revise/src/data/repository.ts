import { seedCards, seedQuestions } from "@/content";
import { allTopics, allSubjects } from "@/domain/curriculum";
import type {
  Attempt,
  Card,
  CalibrationObservation,
  ExamDate,
  Id,
  Mistake,
  Paper,
  PlannedSession,
  PredictionHistoryRecord,
  Question,
  ReviewLog,
  StreakState,
  UserSettings,
} from "@/domain/types";
import {
  isRevisionCheckpoint,
  type RevisionCheckpoint,
} from "@/domain/revision-checkpoint";
import { COLLECTION_STORES, getAll, getDb, putAll, putOne, removeOne } from "./db";
import type { CollectionStore } from "./db";
import { enqueue } from "./sync";
import {
  readReviseMeta,
  readReviseUserMeta,
  REVISE_META_KEYS,
  writeReviseMeta,
  writeReviseUserMeta,
} from "./storage-namespace";

// ---------------------------------------------------------------------------
// The repository is the only thing the UI talks to. It writes IndexedDB, then
// queues the same change for Supabase. Nothing in the UI ever awaits the
// network, so a slow connection can never make the app feel slow.
// ---------------------------------------------------------------------------

export const ONBOARDED_KEY = REVISE_META_KEYS.onboardedAt;
export const LOCAL_USER_ID = "local";

export async function hasOnboarded(userId: Id = LOCAL_USER_ID): Promise<boolean> {
  const scoped = await readReviseUserMeta<string>("onboardedAt", userId);
  if (scoped) return true;
  // Migrate the original single-profile flag only for the local profile.
  return userId === LOCAL_USER_ID && Boolean(await readReviseMeta<string>("onboardedAt"));
}

export async function markOnboarded(userId: Id = LOCAL_USER_ID): Promise<void> {
  await writeReviseUserMeta("onboardedAt", userId, new Date().toISOString());
}

export async function loadRevisionCheckpoint(userId: Id): Promise<RevisionCheckpoint | undefined> {
  const value = await readReviseMeta<unknown>("revisionCheckpoint");
  if (isRevisionCheckpoint(value)) return value.userId === userId ? value : undefined;
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[userId];
  return isRevisionCheckpoint(candidate) && candidate.userId === userId ? candidate : undefined;
}

export async function saveRevisionCheckpoint(checkpoint: RevisionCheckpoint): Promise<void> {
  const current = await readReviseMeta<unknown>("revisionCheckpoint");
  const byUser: Record<string, RevisionCheckpoint> = {};
  if (isRevisionCheckpoint(current)) byUser[current.userId] = current;
  else if (current && typeof current === "object") {
    for (const [userId, value] of Object.entries(current)) {
      if (isRevisionCheckpoint(value) && value.userId === userId) byUser[userId] = value;
    }
  }
  byUser[checkpoint.userId] = checkpoint;
  await writeReviseMeta("revisionCheckpoint", byUser);
}

export async function clearRevisionCheckpoint(userId: Id): Promise<void> {
  const current = await readReviseMeta<unknown>("revisionCheckpoint");
  if (isRevisionCheckpoint(current)) {
    if (current.userId === userId) await writeReviseMeta("revisionCheckpoint", null);
    return;
  }
  if (!current || typeof current !== "object") return;
  const byUser: Record<string, RevisionCheckpoint> = {};
  for (const [key, value] of Object.entries(current)) {
    if (key !== userId && isRevisionCheckpoint(value) && value.userId === key) byUser[key] = value;
  }
  await writeReviseMeta("revisionCheckpoint", Object.keys(byUser).length ? byUser : null);
}

export interface Snapshot {
  cards: Card[];
  reviewLogs: ReviewLog[];
  questions: Question[];
  attempts: Attempt[];
  calibrationObservations: CalibrationObservation[];
  mistakes: Mistake[];
  papers: Paper[];
  predictionHistory: PredictionHistoryRecord[];
  plannedSessions: PlannedSession[];
  examDates: ExamDate[];
  settings: UserSettings;
  streak: StreakState;
}

export function defaultSettings(userId: Id): UserSettings {
  return {
    userId,
    displayName: "Student",
    // Every seeded subject is on by default; onboarding narrows it.
    subjectIds: allSubjects().map((s) => s.id),
    availability: [
      { weekday: 0, minutes: 90 },
      { weekday: 1, minutes: 60 },
      { weekday: 2, minutes: 60 },
      { weekday: 3, minutes: 60 },
      { weekday: 4, minutes: 60 },
      { weekday: 5, minutes: 30 },
      { weekday: 6, minutes: 120 },
    ],
    sessionLengthMinutes: 25,
    targetGrades: {},
    theme: "system",
    accessibility: { largeText: false, dyslexiaFont: false, highContrast: false, reduceMotion: false },
    aiEnabled: true,
    // Pulse never reads this account's study history until it is switched on.
    pulseEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultStreak(userId: Id): StreakState {
  return { userId, current: 0, longest: 0, lastActiveDate: null, xp: 0, achievements: [] };
}

const SEED_VERSION = 1;

/** IndexedDB is shared by local profiles, so every user-owned collection must
 * be filtered at the repository boundary. Keeping this here prevents a new
 * surface from accidentally leaking another profile's learning history. */
function rowsOwnedBy<T extends { userId?: Id }>(rows: unknown[], userId: Id): T[] {
  return rows.filter(
    (row): row is T =>
      Boolean(row) &&
      typeof row === "object" &&
      (row as { userId?: unknown }).userId === userId,
  );
}

/**
 * Install the authored curriculum content for a user. Deterministic ids make
 * this idempotent: a re-run adds topics that appeared since last time and
 * leaves every existing card's FSRS history untouched.
 */
export async function ensureSeeded(userId: Id): Promise<void> {
  const installed = await readReviseMeta<number>("seedVersion");
  const existing = await getAll<Card>("cards");
  const known = new Set(existing.filter((c) => c.userId === userId).map((c) => c.id));

  const wanted = seedCards(allTopics(), userId);
  const missing = wanted.filter((c) => !known.has(c.id));
  if (missing.length) await putAll("cards", missing);

  const existingQuestions = await getAll<Question>("questions");
  const knownQuestions = new Set(existingQuestions.map((q) => q.id));
  const missingQuestions = seedQuestions.filter((q) => !knownQuestions.has(q.id));
  if (missingQuestions.length) await putAll("questions", missingQuestions);

  if (installed !== SEED_VERSION) await writeReviseMeta("seedVersion", SEED_VERSION);
}

export async function loadSnapshot(userId: Id): Promise<Snapshot> {
  await ensureSeeded(userId);
  const db = await getDb();
  // Keyed by store name rather than destructured positionally: COLLECTION_STORES
  // is ordered for sync replay, and tying the read order to it silently swaps
  // collections the moment that order changes.
  const rows = Object.fromEntries(
    await Promise.all(
      COLLECTION_STORES.map(async (store) => [store, await db.getAll(store)] as const),
    ),
  ) as Record<CollectionStore, unknown[]>;

  const settings = ((await db.get("settings", userId)) as UserSettings | undefined) ?? defaultSettings(userId);
  const streak = ((await db.get("streak", userId)) as StreakState | undefined) ?? defaultStreak(userId);

  return {
    cards: rowsOwnedBy<Card>(rows.cards, userId),
    reviewLogs: rowsOwnedBy<ReviewLog>(rows.reviewLogs, userId),
    questions: (rows.questions as Question[]).filter(
      (question) =>
        (question.origin === "seed" && !question.userId) ||
        question.userId === userId ||
        (userId === LOCAL_USER_ID && !question.userId),
    ),
    attempts: rowsOwnedBy<Attempt>(rows.attempts, userId),
    calibrationObservations: rowsOwnedBy<CalibrationObservation>(rows.calibrationObservations, userId),
    mistakes: rowsOwnedBy<Mistake>(rows.mistakes, userId),
    papers: rowsOwnedBy<Paper>(rows.papers, userId),
    predictionHistory: rowsOwnedBy<PredictionHistoryRecord>(rows.predictionHistory, userId),
    plannedSessions: rowsOwnedBy<PlannedSession>(rows.plannedSessions, userId),
    examDates: rowsOwnedBy<ExamDate>(rows.examDates, userId),
    settings,
    streak,
  };
}

// --- writes ----------------------------------------------------------------

export async function saveCard(card: Card): Promise<void> {
  await putOne("cards", card);
  await enqueue("cards", "upsert", card);
}

export async function saveCards(cards: Card[]): Promise<void> {
  await putAll("cards", cards);
  for (const card of cards) await enqueue("cards", "upsert", card);
}

export async function deleteCard(id: Id, userId?: Id): Promise<void> {
  const db = await getDb();
  const existing = (await db.get("cards", id)) as Card | undefined;
  if (userId && existing?.userId !== userId) return;
  await removeOne("cards", id);
  await enqueue("cards", "delete", { id, userId: existing?.userId });
}

/** Bulk delete for the browser's multi-select. One transaction, one pass. */
export async function deleteCards(ids: Id[], userId?: Id): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const existing = await Promise.all(ids.map(async (id) => (await db.get("cards", id)) as Card | undefined));
  const ownedIds = ids.filter((id, index) => Boolean(existing[index]) && (!userId || existing[index]?.userId === userId));
  if (!ownedIds.length) return;
  const tx = db.transaction("cards", "readwrite");
  await Promise.all(ownedIds.map((id) => tx.store.delete(id)));
  await tx.done;
  for (const id of ownedIds) {
    const index = ids.indexOf(id);
    await enqueue("cards", "delete", { id, userId: existing[index]?.userId });
  }
}

export async function saveReviewLog(log: ReviewLog): Promise<void> {
  await putOne("reviewLogs", log);
  await enqueue("reviewLogs", "upsert", log);
}

export async function saveQuestion(question: Question, userId?: Id): Promise<void> {
  const owned = userId && question.origin !== "seed" ? { ...question, userId } : question;
  await putOne("questions", owned);
  await enqueue("questions", "upsert", owned, userId);
}

export async function saveQuestions(questions: Question[], userId?: Id): Promise<void> {
  const owned = questions.map((question) => userId && question.origin !== "seed" ? { ...question, userId } : question);
  await putAll("questions", owned);
  for (const q of owned) await enqueue("questions", "upsert", q, userId);
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  await putOne("attempts", attempt);
  await enqueue("attempts", "upsert", attempt);
}

export async function saveCalibrationObservation(observation: CalibrationObservation): Promise<void> {
  await putOne("calibrationObservations", observation);
  await enqueue("calibrationObservations", "upsert", observation);
}

export async function savePredictionHistory(record: PredictionHistoryRecord): Promise<void> {
  await putOne("predictionHistory", record);
  await enqueue("predictionHistory", "upsert", record);
}

export async function saveMistake(mistake: Mistake): Promise<void> {
  await putOne("mistakes", mistake);
  await enqueue("mistakes", "upsert", mistake);
}

export async function saveMistakes(mistakes: Mistake[]): Promise<void> {
  await putAll("mistakes", mistakes);
  for (const m of mistakes) await enqueue("mistakes", "upsert", m);
}

export async function savePaper(paper: Paper): Promise<void> {
  await putOne("papers", paper);
  await enqueue("papers", "upsert", paper);
}

export async function savePlan(sessions: PlannedSession[]): Promise<void> {
  await putAll("plannedSessions", sessions);
  for (const s of sessions) await enqueue("plannedSessions", "upsert", s);
}

export async function replacePlan(userId: Id, sessions: PlannedSession[]): Promise<void> {
  const db = await getDb();
  const existing = (await db.getAll("plannedSessions")) as PlannedSession[];
  const keep = new Set(sessions.map((s) => s.id));
  const removed = existing.filter((s) => s.userId === userId && !keep.has(s.id));
  const tx = db.transaction("plannedSessions", "readwrite");
  await Promise.all(
    removed.map((s) => tx.store.delete(s.id)),
  );
  await Promise.all(sessions.map((s) => tx.store.put(s)));
  await tx.done;
  for (const session of removed) await enqueue("plannedSessions", "delete", { id: session.id, userId });
  for (const s of sessions) await enqueue("plannedSessions", "upsert", s);
}

export async function saveExamDate(exam: ExamDate): Promise<void> {
  await putOne("examDates", exam);
  await enqueue("examDates", "upsert", exam);
}

export async function deleteExamDate(id: Id, userId?: Id): Promise<void> {
  const db = await getDb();
  const existing = (await db.get("examDates", id)) as ExamDate | undefined;
  if (userId && existing?.userId !== userId) return;
  await removeOne("examDates", id);
  await enqueue("examDates", "delete", { id, userId: existing?.userId });
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDb();
  await db.put("settings", settings);
  await enqueue("settings", "upsert", settings);
}

export async function saveStreak(streak: StreakState): Promise<void> {
  const db = await getDb();
  await db.put("streak", streak);
  await enqueue("streak", "upsert", streak);
}
