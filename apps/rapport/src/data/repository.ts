import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import { SCORING_MODEL_VERSION, recomputeStates } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";
import { emptyHumanEvidence } from "@/domain/human-evidence";
import type { HumanEvidenceState } from "@/domain/human-evidence";
import { redact, shouldRedact } from "@/domain/reflection";
import type {
  Achievement,
  Challenge,
  ChallengeAttempt,
  Experiment,
  ExperimentObservation,
  Exercise,
  Goal,
  Id,
  Insight,
  Preference,
  Reflection,
  ReflectionSignal,
  Simulation,
  SimulationEvaluation,
  SimulationScenario,
  Snapshot,
  TrainingSession,
  User,
  UserSkillState,
  WeeklyReview,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Local-first persistence.
//
// Everything lives in IndexedDB on the user's device. There is no account, no
// server round-trip on the critical path, and nothing leaves the device unless
// the user turns on sync and sets a passphrase.
//
// Skill states are stored as a cached projection of the event log, stamped with
// the scoring-model version that produced them. When the app ships a change to
// the mastery or evaluation model, the stamp no longer matches and states are
// re-derived from events on the next load — no migration, no stale numbers.
// ---------------------------------------------------------------------------

export const LOCAL_USER_ID = "local";
export const HUMAN_EVIDENCE_META_KEY = "humanEvidence";
export const CORPUS_BENCHMARK_META_KEY = "corpusBenchmark";
export const BENCHMARK_CONSENT_KEY = "benchmarkConsent";
const DB_NAME = "rapport";
const DB_VERSION = 1;

interface RapportSchema extends DBSchema {
  meta: { key: string; value: unknown };
  events: { key: string; value: DomainEvent & { id: string }; indexes: { at: string } };
  skillStates: { key: string; value: UserSkillState };
  goals: { key: string; value: Goal };
  simulations: { key: string; value: Simulation };
  evaluations: { key: string; value: SimulationEvaluation };
  attempts: { key: string; value: ChallengeAttempt };
  reflections: { key: string; value: Reflection };
  signals: { key: string; value: ReflectionSignal };
  sessions: { key: string; value: TrainingSession };
  insights: { key: string; value: Insight };
  experiments: { key: string; value: Experiment };
  observations: { key: string; value: ExperimentObservation };
  reviews: { key: string; value: WeeklyReview };
  achievements: { key: string; value: Achievement };
  exercises: { key: string; value: Exercise };
  challenges: { key: string; value: Challenge };
  scenarios: { key: string; value: SimulationScenario };
}

let dbPromise: Promise<IDBPDatabase<RapportSchema>> | null = null;

function db(): Promise<IDBPDatabase<RapportSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RapportSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("meta");
        const events = database.createObjectStore("events", { keyPath: "id" });
        events.createIndex("at", "at");
        database.createObjectStore("skillStates", { keyPath: "skillId" });
        database.createObjectStore("goals", { keyPath: "id" });
        database.createObjectStore("simulations", { keyPath: "id" });
        database.createObjectStore("evaluations", { keyPath: "id" });
        database.createObjectStore("attempts", { keyPath: "id" });
        database.createObjectStore("reflections", { keyPath: "id" });
        database.createObjectStore("signals", { keyPath: "reflectionId" });
        database.createObjectStore("sessions", { keyPath: "id" });
        database.createObjectStore("insights", { keyPath: "id" });
        database.createObjectStore("experiments", { keyPath: "id" });
        database.createObjectStore("observations", { keyPath: "id" });
        database.createObjectStore("reviews", { keyPath: "id" });
        database.createObjectStore("achievements", { keyPath: "id" });
        database.createObjectStore("exercises", { keyPath: "id" });
        database.createObjectStore("challenges", { keyPath: "id" });
        database.createObjectStore("scenarios", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_PREFERENCE: Omit<Preference, "userId" | "updatedAt"> = {
  intensity: "steady",
  sessionMinutes: 10,
  contexts: ["social", "work"],
  // Private by default. Every one of these is off until the user turns it on.
  syncEnabled: false,
  aiMayReadReflections: false,
  allowModelTraining: false,
  retentionDays: 0,
  theme: "system",
  reducedMotion: false,
  voiceEnabled: false,
  assistLevel: "full",
};

export async function getUser(): Promise<User | null> {
  const database = await db();
  return ((await database.get("meta", "user")) as User | undefined) ?? null;
}

export async function saveUser(user: User): Promise<void> {
  const database = await db();
  await database.put("meta", user, "user");
}

export async function getPreference(): Promise<Preference> {
  const database = await db();
  const stored = (await database.get("meta", "preference")) as Preference | undefined;
  if (stored) return stored;
  return { ...DEFAULT_PREFERENCE, userId: LOCAL_USER_ID, updatedAt: new Date().toISOString() };
}

export async function savePreference(preference: Preference): Promise<void> {
  const database = await db();
  await database.put("meta", preference, "preference");
}

/**
 * Insights are derived from the event log on every load, so the only thing
 * worth persisting about them is which ones the user has dismissed — storing
 * the insights themselves would mean showing conclusions the current evidence
 * no longer supports.
 */
export async function dismissedInsightIds(): Promise<string[]> {
  const database = await db();
  return ((await database.get("meta", "dismissedInsights")) as string[] | undefined) ?? [];
}

export async function saveDismissedInsightIds(ids: string[]): Promise<void> {
  const database = await db();
  await database.put("meta", ids, "dismissedInsights");
}

/** The research workspace is local-first and travels with the normal export. */
export async function getHumanEvidence(): Promise<HumanEvidenceState> {
  const database = await db();
  return ((await database.get("meta", HUMAN_EVIDENCE_META_KEY)) as HumanEvidenceState | undefined) ?? emptyHumanEvidence();
}

export async function saveHumanEvidence(state: HumanEvidenceState): Promise<void> {
  const database = await db();
  await database.put("meta", state, HUMAN_EVIDENCE_META_KEY);
}

// --- Benchmark corpus (research data, separable, opt-in, deletable) ------------

import type { CorpusBenchmark } from "@/domain/corpus";
import { emptyCorpus } from "@/domain/corpus";

export async function getCorpusBenchmark(): Promise<CorpusBenchmark> {
  const database = await db();
  return ((await database.get("meta", CORPUS_BENCHMARK_META_KEY)) as CorpusBenchmark | undefined) ?? emptyCorpus(new Date().toISOString());
}

export async function saveCorpusBenchmark(corpus: CorpusBenchmark): Promise<void> {
  const database = await db();
  await database.put("meta", corpus, CORPUS_BENCHMARK_META_KEY);
}

export async function deleteCorpusBenchmark(): Promise<void> {
  const database = await db();
  await database.delete("meta", CORPUS_BENCHMARK_META_KEY);
  await database.delete("meta", BENCHMARK_CONSENT_KEY);
}

/** Whether benchmark sharing is opted-in. Default false. */
export async function getBenchmarkConsent(): Promise<{ optedIn: boolean; at?: string; version?: string }> {
  const database = await db();
  return ((await database.get("meta", BENCHMARK_CONSENT_KEY)) as { optedIn: boolean; at?: string; version?: string } | undefined) ?? { optedIn: false };
}

export async function setBenchmarkConsent(optedIn: boolean, version = "2026-08-20.1"): Promise<void> {
  const database = await db();
  if (optedIn) await database.put("meta", { optedIn: true, at: new Date().toISOString(), version }, BENCHMARK_CONSENT_KEY);
  else {
    await database.delete("meta", BENCHMARK_CONSENT_KEY);
    // Opting out deletes the separable research copy but leaves normal product data untouched
    await deleteCorpusBenchmark();
  }
}

/**
 * Export benchmark/research data separately from normal product export.
 * Benchmark export is opt-in only; if not opted in, returns null.
 * The export is user-controlled — the user holds the file, not the server.
 */
export async function exportBenchmark(): Promise<{ exportedAt: string; corpus: CorpusBenchmark } | null> {
  const consent = await getBenchmarkConsent();
  if (!consent.optedIn) return null;
  const corpus = await getCorpusBenchmark();
  return { exportedAt: new Date().toISOString(), corpus };
}

/**
 * Totally separable: normal export excludes benchmark data. The benchmark
 * must be exported via exportBenchmark(). This prevents accidental linkage.
 */
export async function exportNormalExcludingBenchmark(now: string): Promise<{ exportedAt: string; version: number; snapshot: Snapshot; events: DomainEvent[] }> {
  const [data, events] = await Promise.all([snapshot(now), allEvents()]);
  return { exportedAt: now, version: SCORING_MODEL_VERSION, snapshot: data, events };
}

let eventCounter = 0;

/** Append an event and return the refreshed skill-state projection. */
export async function appendEvent(event: DomainEvent, now: string): Promise<UserSkillState[]> {
  const database = await db();
  eventCounter += 1;
  const id = `${event.at}.${eventCounter.toString(36)}.${Math.random().toString(36).slice(2, 8)}`;
  await database.put("events", { ...event, id });
  return refreshStates(now);
}

export async function allEvents(): Promise<DomainEvent[]> {
  const database = await db();
  const rows = await database.getAll("events");
  return rows
    .map((row) => {
      const event = { ...row } as Partial<{ id: string }> & DomainEvent;
      delete event.id;
      return event as DomainEvent;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Re-fold the log and cache the result with the current model version. */
export async function refreshStates(now: string): Promise<UserSkillState[]> {
  const database = await db();
  const events = await allEvents();
  const states = recomputeStates(LOCAL_USER_ID, events, now);
  const tx = database.transaction("skillStates", "readwrite");
  await Promise.all(states.map((state) => tx.store.put(state)));
  await tx.done;
  await database.put("meta", SCORING_MODEL_VERSION, "scoringVersion");
  return states;
}

export async function getSkillStates(now: string): Promise<UserSkillState[]> {
  const database = await db();
  const storedVersion = (await database.get("meta", "scoringVersion")) as number | undefined;
  if (storedVersion !== SCORING_MODEL_VERSION) return refreshStates(now);
  const states = await database.getAll("skillStates");
  if (states.length === 0) return refreshStates(now);
  return states;
}

type Collection =
  | "goals"
  | "simulations"
  | "evaluations"
  | "attempts"
  | "reflections"
  | "signals"
  | "sessions"
  | "insights"
  | "experiments"
  | "observations"
  | "reviews"
  | "achievements"
  | "exercises"
  | "challenges"
  | "scenarios";

export async function put<K extends Collection>(collection: K, value: RapportSchema[K]["value"]): Promise<void> {
  const database = await db();
  await database.put(collection, value);
}

export async function putMany<K extends Collection>(collection: K, values: RapportSchema[K]["value"][]): Promise<void> {
  if (values.length === 0) return;
  const database = await db();
  const tx = database.transaction(collection, "readwrite");
  await Promise.all(values.map((value) => tx.store.put(value)));
  await tx.done;
}

export async function all<K extends Collection>(collection: K): Promise<RapportSchema[K]["value"][]> {
  const database = await db();
  return database.getAll(collection);
}

export async function get<K extends Collection>(collection: K, key: Id): Promise<RapportSchema[K]["value"] | undefined> {
  const database = await db();
  return database.get(collection, key);
}

export async function remove(collection: Collection, key: Id): Promise<void> {
  const database = await db();
  await database.delete(collection, key);
}

/** Everything for this user, in one object. The unit of export and of sync. */
export async function snapshot(now: string): Promise<Snapshot> {
  const [
    user,
    preference,
    goals,
    skillStates,
    simulations,
    evaluations,
    attempts,
    reflections,
    signals,
    sessions,
    insights,
    experiments,
    observations,
    reviews,
    achievements,
    exercises,
    challenges,
    scenarios,
  ] = await Promise.all([
    getUser(),
    getPreference(),
    all("goals"),
    getSkillStates(now),
    all("simulations"),
    all("evaluations"),
    all("attempts"),
    all("reflections"),
    all("signals"),
    all("sessions"),
    all("insights"),
    all("experiments"),
    all("observations"),
    all("reviews"),
    all("achievements"),
    all("exercises"),
    all("challenges"),
    all("scenarios"),
  ]);

  return {
    user: user ?? {
      id: LOCAL_USER_ID,
      displayName: "",
      createdAt: now,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    },
    preference,
    goals,
    skillStates,
    assessments: [],
    simulations,
    evaluations,
    challengeAttempts: attempts,
    reflections,
    reflectionSignals: signals,
    sessions,
    insights,
    experiments,
    observations,
    reviews,
    achievements,
    generatedExercises: exercises,
    generatedChallenges: challenges,
    savedScenarios: scenarios,
  };
}

/** Full export: the snapshot plus the raw event log, so a copy is self-sufficient. */
export async function exportAll(now: string): Promise<{
  exportedAt: string;
  version: number;
  snapshot: Snapshot;
  events: DomainEvent[];
  humanEvidence: HumanEvidenceState;
}> {
  const [data, events, humanEvidence] = await Promise.all([snapshot(now), allEvents(), getHumanEvidence()]);
  return { exportedAt: now, version: SCORING_MODEL_VERSION, snapshot: data, events, humanEvidence };
}

/**
 * Delete everything, irreversibly. Not a soft delete and not a tombstone —
 * the object stores are emptied, including the event log.
 */
export async function wipe(): Promise<void> {
  const database = await db();
  const stores: (Collection | "meta" | "events" | "skillStates")[] = [
    "meta",
    "events",
    "skillStates",
    "goals",
    "simulations",
    "evaluations",
    "attempts",
    "reflections",
    "signals",
    "sessions",
    "insights",
    "experiments",
    "observations",
    "reviews",
    "achievements",
    "exercises",
    "challenges",
    "scenarios",
  ];
  for (const store of stores) {
    await database.clear(store as never);
  }
}

/** Delete one reflection and its derived signal. Available from the UI on every entry. */
export async function deleteReflection(id: Id): Promise<void> {
  const database = await db();
  await database.delete("reflections", id);
  await database.delete("signals", id);
}

/**
 * Apply the retention policy: strip free text older than the configured window
 * while keeping the derived signals, so long-run analytics survive without the
 * app holding years of private writing.
 */
export async function applyRetention(retentionDays: number, now: string): Promise<number> {
  if (retentionDays <= 0) return 0;
  const reflections = await all("reflections");
  const stale = reflections.filter((reflection) => shouldRedact(reflection, retentionDays, now));
  await putMany("reflections", stale.map((reflection) => redact(reflection, now)));
  return stale.length;
}

/** Replace local data with an imported export. Used by restore and by sync pull. */
export async function importAll(
  payload: { snapshot: Snapshot; events: DomainEvent[]; humanEvidence?: HumanEvidenceState },
  now: string,
): Promise<void> {
  await wipe();
  const database = await db();
  await saveUser(payload.snapshot.user);
  await savePreference(payload.snapshot.preference);

  let counter = 0;
  const tx = database.transaction("events", "readwrite");
  await Promise.all(
    payload.events.map((event) => {
      counter += 1;
      return tx.store.put({ ...event, id: `${event.at}.${counter.toString(36)}` });
    }),
  );
  await tx.done;

  await putMany("goals", payload.snapshot.goals);
  await putMany("simulations", payload.snapshot.simulations);
  await putMany("evaluations", payload.snapshot.evaluations);
  await putMany("attempts", payload.snapshot.challengeAttempts);
  await putMany("reflections", payload.snapshot.reflections);
  await putMany("signals", payload.snapshot.reflectionSignals);
  await putMany("sessions", payload.snapshot.sessions);
  await putMany("insights", payload.snapshot.insights);
  await putMany("experiments", payload.snapshot.experiments);
  await putMany("observations", payload.snapshot.observations);
  await putMany("reviews", payload.snapshot.reviews);
  await putMany("achievements", payload.snapshot.achievements);
  await putMany("exercises", payload.snapshot.generatedExercises);
  await putMany("challenges", payload.snapshot.generatedChallenges);
  await putMany("scenarios", payload.snapshot.savedScenarios);
  if (payload.humanEvidence) await saveHumanEvidence(payload.humanEvidence);
  await refreshStates(now);
}

/**
 * Close and drop the cached connection. Used by tests to open a fresh
 * database, and by the wipe flow so a pending connection cannot block a
 * subsequent delete.
 */
export async function resetConnection(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  eventCounter = 0;
  if (pending) {
    try {
      (await pending).close();
    } catch {
      // Already closed or never opened; nothing to do.
    }
  }
}
