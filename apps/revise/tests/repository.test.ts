import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAll, COLLECTION_STORES } from "@/data/db";
import {
  defaultSettings,
  ensureSeeded,
  loadSnapshot,
  saveAttempt,
  saveCard,
  saveCalibrationObservation,
  saveExamDate,
  savePlan,
  savePredictionHistory,
} from "@/data/repository";
import { allTopics } from "@/domain/curriculum";
import { isDue, todayIso } from "@/domain/scheduling";
import { CALIBRATION_MODEL_VERSION, CALIBRATION_PRIOR_V1 } from "@/domain/calibration-priors";
import type { Attempt, CalibrationObservation, ExamDate, PlannedSession, PredictionHistoryRecord } from "@/domain/types";

// These exercise the real IndexedDB code path against an in-memory
// implementation. They exist because a positional destructure of the store
// list once silently swapped `cards` and `questions` in the loaded snapshot —
// every card came back as a question, nothing was ever due, and the app looked
// empty despite the database being full. Type checking could not catch it, and
// no pure-domain test could either.

const USER = "test-user";

beforeEach(async () => {
  await clearAll();
});

describe("loadSnapshot", () => {
  it("returns each collection under its own key", async () => {
    const snapshot = await loadSnapshot(USER);

    expect(snapshot.cards.length).toBeGreaterThan(100);
    expect(snapshot.questions.length).toBeGreaterThan(20);
    // The distinguishing shape check: a card has FSRS state, a question has marks.
    expect(snapshot.cards.every((c) => typeof c.due === "string" && typeof c.stability === "number")).toBe(true);
    expect(snapshot.questions.every((q) => Array.isArray(q.parts) && typeof q.totalMarks === "number")).toBe(true);
    expect(snapshot.reviewLogs).toEqual([]);
    expect(snapshot.attempts).toEqual([]);
  });

  it("makes freshly seeded cards due today, so a new user has something to do", async () => {
    const snapshot = await loadSnapshot(USER);
    const today = todayIso();
    expect(snapshot.cards.filter((c) => isDue(c, today)).length).toBe(snapshot.cards.length);
  });

  it("keeps user-owned learning history and seeded cards isolated between profiles", async () => {
    const first = await loadSnapshot("user-a");
    const second = await loadSnapshot("user-b");
    const attempt: Attempt = {
      id: "attempt-user-a",
      userId: "user-a",
      questionId: first.questions[0].id,
      subjectId: first.questions[0].subjectId,
      topicIds: first.questions[0].topicIds,
      answers: {},
      marked: [],
      awarded: 0,
      max: 1,
      feedback: "",
      markedBy: "rubric",
      elapsedMs: 1000,
      mode: "practice",
      createdAt: new Date().toISOString(),
    };
    await saveAttempt(attempt);

    const reloadedA = await loadSnapshot("user-a");
    const reloadedB = await loadSnapshot("user-b");
    expect(reloadedA.attempts.map((row) => row.id)).toContain(attempt.id);
    expect(reloadedB.attempts).toEqual([]);
    expect(second.cards.some((card) => card.id.startsWith("seed:user-b:"))).toBe(true);
    expect(reloadedB.cards.some((card) => card.userId === "user-a")).toBe(false);
  });

  it("covers every topic in the registered curriculum", async () => {
    const snapshot = await loadSnapshot(USER);
    const seeded = new Set(snapshot.cards.map((c) => c.topicId));
    for (const topic of allTopics()) {
      expect(seeded.has(topic.id), `no cards for ${topic.id}`).toBe(true);
    }
  });

  it("falls back to sensible defaults when nothing is stored", async () => {
    const snapshot = await loadSnapshot(USER);
    expect(snapshot.settings.subjectIds.length).toBeGreaterThan(0);
    expect(snapshot.settings.sessionLengthMinutes).toBe(defaultSettings(USER).sessionLengthMinutes);
    expect(snapshot.streak.current).toBe(0);
  });

  it("round-trips writes through every collection", async () => {
    const before = await loadSnapshot(USER);
    const card = { ...before.cards[0], due: "2030-01-01", reps: 7 };
    await saveCard(card);

    const attempt: Attempt = {
      id: "attempt-1",
      userId: USER,
      questionId: before.questions[0].id,
      subjectId: before.questions[0].subjectId,
      topicIds: before.questions[0].topicIds,
      answers: {},
      marked: [],
      awarded: 4,
      max: 6,
      feedback: "ok",
      markedBy: "rubric",
      elapsedMs: 1000,
      mode: "practice",
      createdAt: new Date().toISOString(),
    };
    await saveAttempt(attempt);

    const observedAt = "2026-03-01T12:00:00.000Z";
    const observation: CalibrationObservation = {
      id: "calibration-observation-1",
      userId: USER,
      subjectId: before.questions[0].subjectId,
      topicId: before.questions[0].topicIds[0],
      laterQuestionId: before.questions[1].id,
      revisionAction: "practice",
      revisionAt: "2026-02-28T12:00:00.000Z",
      durationMinutes: 25,
      baselineMastery: 0.3,
      baselineEvidence: 4,
      laterQuestionWasUnseen: true,
      outcomeAt: observedAt,
      actualMarks: 4,
      maxMarks: 6,
      createdAt: observedAt,
      updatedAt: observedAt,
      source: "observed",
    };
    await saveCalibrationObservation(observation);

    const prediction: PredictionHistoryRecord = {
      id: "prediction-history-1",
      userId: USER,
      subjectId: before.questions[0].subjectId,
      paperSpecId: "paper-spec-1",
      paperRunId: "paper-run-1",
      predictedAt: "2026-02-28T12:00:00.000Z",
      modelVersion: CALIBRATION_MODEL_VERSION,
      priorVersion: CALIBRATION_PRIOR_V1.version,
      source: "population-prior",
      personalSampleSize: 0,
      predictedMarks: 40,
      predictedMarksLower: 20,
      predictedMarksUpper: 60,
      totalMarks: 60,
      predictedPercent: 40 / 60,
      predictedPercentLower: 20 / 60,
      predictedPercentUpper: 1,
      createdAt: "2026-02-28T12:00:00.000Z",
      updatedAt: "2026-02-28T12:00:00.000Z",
    };
    await savePredictionHistory(prediction);

    const exam: ExamDate = {
      id: "exam-1",
      userId: USER,
      subjectId: before.questions[0].subjectId,
      date: "2030-06-01",
      label: "Unit 3",
    };
    await saveExamDate(exam);

    const session: PlannedSession = {
      id: "session-1",
      userId: USER,
      date: todayIso(),
      startMinute: 960,
      minutes: 25,
      subjectId: exam.subjectId,
      activity: "flashcards",
      reason: "due cards",
      status: "pending",
    };
    await savePlan([session]);

    const after = await loadSnapshot(USER);
    expect(after.cards.find((c) => c.id === card.id)?.reps).toBe(7);
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].awarded).toBe(4);
    expect(after.calibrationObservations).toHaveLength(1);
    expect(after.calibrationObservations[0].laterQuestionId).toBe(before.questions[1].id);
    expect(after.predictionHistory).toHaveLength(1);
    expect(after.predictionHistory[0].modelVersion).toBe(CALIBRATION_MODEL_VERSION);
    expect(after.examDates).toHaveLength(1);
    expect(after.plannedSessions).toHaveLength(1);
    expect(after.plannedSessions[0].activity).toBe("flashcards");
  });
});

describe("ensureSeeded", () => {
  it("is idempotent and never resets review history", async () => {
    const first = await loadSnapshot(USER);
    const graded = { ...first.cards[0], reps: 5, stability: 40, due: "2030-01-01" };
    await saveCard(graded);

    await ensureSeeded(USER);
    const second = await loadSnapshot(USER);

    expect(second.cards).toHaveLength(first.cards.length);
    expect(second.questions).toHaveLength(first.questions.length);
    const survivor = second.cards.find((c) => c.id === graded.id);
    expect(survivor?.reps).toBe(5);
    expect(survivor?.due).toBe("2030-01-01");
  });
});

describe("db module", () => {
  it("lists every user-owned collection exactly once", () => {
    expect(new Set(COLLECTION_STORES).size).toBe(COLLECTION_STORES.length);
    expect(COLLECTION_STORES).toContain("cards");
    expect(COLLECTION_STORES).toContain("questions");
  });
});
