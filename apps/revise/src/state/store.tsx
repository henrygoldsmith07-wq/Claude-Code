"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { allSubjects, allTopics, getSubject } from "@/domain/curriculum";
import { misconceptionsForTopic, seedMisconceptions } from "@/content";
import { predictGrade } from "@/domain/grades";
import type { GradePrediction } from "@/domain/grades";
import { computeTopicMastery } from "@/domain/mastery";
import {
  applyRetestToMistake,
  evaluateMistakeRetest,
  mistakesFromAttempt,
  shouldResolve,
} from "@/domain/mistakes";
import { computeApplicationMastery } from "@/domain/application-mastery";
import { computeRecallMastery } from "@/domain/recall-mastery";
import { masteryIntervals } from "@/domain/mastery-uncertainty";
import { tallyMisconceptions, type MisconceptionTally } from "@/domain/misconception-library";
import { buildPlan, rescheduleMissedPrioritised } from "@/domain/planner";
import { buildErrorModel, type ErrorModelEntry } from "@/domain/error-model";
import {
  computeFingerprint,
  fingerprintKey,
  learnerStateKey,
  replanDynamically,
  type ReplanFingerprint,
} from "@/domain/replan";
import { recommend } from "@/domain/recommender";
import { gradeCard, isDue, todayIso } from "@/domain/scheduling";
import { addXp, newlyUnlocked, touchStreak, unlockedAchievements, XP } from "@/domain/gamification";
import { buildAssessmentInsight, simulatePaper } from "@/domain/assessment";
import { CALIBRATION_PRIOR_V1 } from "@/domain/calibration-priors";
import {
  buildCalibrationModel,
  estimateMarksPerHour,
  estimateRecoverableMarks,
  evaluatePaperCalibration,
  observationFromRevisionAndOutcome,
  observationsFromAttempts,
  type CalibrationModel,
} from "@/domain/calibration";
import { calibrateDifficulty, traceQuestions } from "@/domain/knowledge-tracing";
import type { DifficultyCalibrationReport, QuestionTrace } from "@/domain/knowledge-tracing";
import { calculateCalculationMastery } from "@/domain/calculation-mastery";
import type { CalculationMasteryReport } from "@/domain/calculation-mastery";
import {
  adaptiveDifficultyCalibration,
  buildPredictionOutcomePairs,
  predictionOutcomeReport,
  sparseEvidenceConfidence as buildSparseEvidenceConfidence,
} from "@/domain/learning-controls";
import type {
  AdaptiveDifficultyReport,
  PredictionOutcomeReport,
  SparseEvidenceConfidenceReport,
} from "@/domain/learning-controls";
import { questionExposureReport } from "@/domain/question-exposure";
import type { QuestionExposureReport } from "@/domain/question-exposure";
import { rootPrerequisiteRemediation as buildRootPrerequisiteRemediation } from "@/domain/prerequisites";
import type { RootPrerequisiteRemediation } from "@/domain/prerequisites";
import { validateFsrs } from "@/domain/fsrs-tuning";
import type { FsrsValidation } from "@/domain/fsrs-tuning";
import { buildResponseTimeCalibration } from "@/domain/response-time-calibration";
import type { ResponseTimeCalibrationReport } from "@/domain/response-time-calibration";
import type {
  AssessmentInsight,
  Attempt,
  Calibration,
  CalibrationObservation,
  Card,
  ExamDate,
  GamificationStats,
  Id,
  Mistake,
  Paper,
  PaperSimulation,
  PlannedSession,
  PredictionHistoryRecord,
  Question,
  Recommendation,
  RecallGrade,
  ReviewLog,
  StreakState,
  TopicMastery,
  UserSettings,
} from "@/domain/types";
import type { ApplicationMasteryRow } from "@/domain/application-mastery";
import type { RecallMasteryRow } from "@/domain/recall-mastery";
import type { MasteryInterval } from "@/domain/mastery-uncertainty";
import * as repo from "@/data/repository";
import { LOCAL_USER_ID } from "@/data/repository";
import type { Snapshot } from "@/data/repository";
import { SYNC_QUEUE_EVENT, outboxSize, sync } from "@/data/sync";
import { getSupabase, isSupabaseConfigured } from "@/data/supabase";
import {
  createRevisionCheckpoint,
  type RevisionCheckpoint,
  type RevisionCheckpointInput,
} from "@/domain/revision-checkpoint";

// ---------------------------------------------------------------------------
// One store for the whole app. Revision data is small (thousands of rows at
// most), so it is held in memory and recomputed on change — that keeps every
// derived number (mastery, recommendations, predicted grade) consistent by
// construction instead of by cache invalidation. Writes go to IndexedDB first
// and the outbox second; the UI never awaits the network.
// ---------------------------------------------------------------------------

export interface SyncStatus {
  online: boolean;
  pending: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  enabled: boolean;
  syncing: boolean;
}

interface StoreValue extends Snapshot {
  ready: boolean;
  /** True until the student has been through (or skipped) onboarding. */
  needsOnboarding: boolean;
  completeOnboarding(): Promise<void>;
  userId: Id;
  mastery: TopicMastery[];
  masteryUncertainty: MasteryInterval[];
  applicationMastery: ApplicationMasteryRow[];
  recallMastery: RecallMasteryRow[];
  recommendations: Recommendation[];
  predictions: GradePrediction[];
  dueCards: Card[];
  assessment: AssessmentInsight | null;
  /** Expected exam marks gained per study hour, keyed by topic. The metric the brief asks for. */
  marksPerHour: Map<Id, number>;
  /** Versioned empirical model and its explicit prior/data provenance. */
  calibrationModel: CalibrationModel;
  /** Misconception-library entries the student keeps hitting, most frequent first. */
  recurringMisconceptions: MisconceptionTally[];
  /** A recency-weighted error model used by planning, practice, and progress surfaces. */
  errorModel: ErrorModelEntry[];
  /** Why the plan last changed itself, or null when nothing has. */
  replanSummary: string | null;
  calibrations: Map<Id, Calibration>;
  questionTraces: QuestionTrace[];
  difficultyCalibration: DifficultyCalibrationReport;
  calculationMastery: CalculationMasteryReport;
  sparseEvidenceConfidence: SparseEvidenceConfidenceReport;
  predictionOutcome: PredictionOutcomeReport;
  adaptiveDifficulty: AdaptiveDifficultyReport;
  forgettingCalibration: FsrsValidation;
  questionExposure: QuestionExposureReport;
  rootPrerequisiteRemediation: RootPrerequisiteRemediation[];
  revisionCheckpoint: RevisionCheckpoint | null;
  responseTimeCalibration: ResponseTimeCalibrationReport;
  syncStatus: SyncStatus;
  /** Build a paper simulation for the given subject/paper without mutating state. */
  previewPaper(subjectId: Id, paperSpecId: Id, questionIds: Id[]): PaperSimulation | null;
  // actions
  reviewCard(card: Card, grade: RecallGrade, elapsedMs: number, confidence?: 1 | 2 | 3 | 4 | 5): Promise<void>;
  recordAttempt(attempt: Attempt, question: Question): Promise<Mistake[]>;
  recordCalibrationObservation(observation: CalibrationObservation): Promise<void>;
  recordPredictionHistory(record: PredictionHistoryRecord): Promise<void>;
  completePredictionHistory(id: Id, outcome: { marks: number; totalMarks: number; at: string }): Promise<void>;
  addCards(cards: Card[]): Promise<void>;
  removeCard(id: Id): Promise<void>;
  /** Bulk save for the browser: tag edits, suspend, bury, field rewrites. */
  updateCards(cards: Card[]): Promise<void>;
  removeCards(ids: Id[]): Promise<void>;
  addQuestions(questions: Question[]): Promise<void>;
  addPaper(paper: Paper): Promise<void>;
  regeneratePlan(): Promise<void>;
  rescheduleMissedSessions(): Promise<void>;
  completeSession(sessionId: Id, status?: PlannedSession["status"]): Promise<void>;
  upsertExamDate(exam: ExamDate): Promise<void>;
  removeExamDate(id: Id): Promise<void>;
  updateSettings(patch: Partial<UserSettings>): Promise<void>;
  saveRevisionCheckpoint(input: RevisionCheckpointInput): Promise<void>;
  clearRevisionCheckpoint(): Promise<void>;
  syncNow(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}

export function StoreProvider({ children, userId: requestedUserId }: { children: ReactNode; userId?: Id }) {
  const [authUserId, setAuthUserId] = useState<Id | null>(requestedUserId ?? null);
  const [authReady, setAuthReady] = useState(() => Boolean(requestedUserId) || !isSupabaseConfigured);
  const userId = requestedUserId ?? (authReady ? authUserId ?? LOCAL_USER_ID : LOCAL_USER_ID);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revisionCheckpoint, setRevisionCheckpoint] = useState<RevisionCheckpoint | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    online: true,
    pending: 0,
    lastSyncedAt: null,
    lastSyncError: null,
    enabled: isSupabaseConfigured,
    syncing: false,
  });
  const bootstrappedUser = useRef<Id | null>(null);
  const [replanSummary, setReplanSummary] = useState<string | null>(null);
  const lastFingerprint = useRef<ReplanFingerprint | null>(null);

  // Resolve the authenticated profile before loading IndexedDB. A configured
  // Supabase client uses the auth UUID as the local key too, so queued writes
  // and RLS rows cannot accidentally be stored under the anonymous "local"
  // profile. Explicit userId remains available for embedded/test callers.
  useEffect(() => {
    if (requestedUserId || !isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    setAuthUserId(null);
    const supabase = getSupabase();
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSnapshot(null);
      setRevisionCheckpoint(null);
      setNeedsOnboarding(false);
      lastFingerprint.current = null;
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [requestedUserId]);

  useEffect(() => {
    if (!authReady) return;
    if (bootstrappedUser.current === userId) return;
    bootstrappedUser.current = userId;
    setSnapshot(null);
    setRevisionCheckpoint(null);
    setNeedsOnboarding(false);
    lastFingerprint.current = null;
    let cancelled = false;
    void (async () => {
      const [loaded, checkpoint] = await Promise.all([
        repo.loadSnapshot(userId),
        repo.loadRevisionCheckpoint(userId),
      ]);
      if (cancelled) return;
      setRevisionCheckpoint(checkpoint ?? null);
      setSnapshot(loaded);
      const loadedTopics = allTopics(loaded.settings.subjectIds);
      const loadedMastery = computeTopicMastery({
        topics: loadedTopics,
        cards: loaded.cards,
        reviewLogs: loaded.reviewLogs,
        attempts: loaded.attempts,
        mistakes: loaded.mistakes,
      });
      lastFingerprint.current = computeFingerprint({
        exams: loaded.examDates,
        targetGrades: loaded.settings.targetGrades,
        availability: loaded.settings.availability,
        availabilityOverrides: loaded.settings.availabilityOverrides,
        sessionLengthMinutes: loaded.settings.sessionLengthMinutes,
        subjectIds: loaded.settings.subjectIds,
        learnerStateKey: learnerStateKey({
          mastery: loadedMastery,
          cards: loaded.cards,
          mistakes: loaded.mistakes,
          attempts: loaded.attempts,
        }),
      });
      setNeedsOnboarding(!(await repo.hasOnboarded(userId)));
      if (cancelled) return;
      // A plan that has drifted into the past is worse than no plan: fold
      // missed sessions forward before the dashboard renders anything.
      const today = todayIso();
      const stale = loaded.plannedSessions.some((s) => s.date < today && s.status === "pending");
      if (stale) {
        const healed = rescheduleMissedPrioritised(loaded.plannedSessions, today, 6, loadedMastery, loaded.examDates);
        await repo.savePlan(healed);
        if (cancelled) return;
        setSnapshot((prev) => (prev ? { ...prev, plannedSessions: healed } : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, userId]);

  // Network status drives the offline banner and gates sync attempts.
  useEffect(() => {
    const update = () => {
      const online = navigator.onLine;
      setSyncStatus((s) => ({ ...s, online, lastSyncError: online ? s.lastSyncError : null }));
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Local writes enqueue after IndexedDB succeeds. Reflect that immediately so
  // offline work is visibly safe instead of waiting for the next retry timer.
  useEffect(() => {
    if (!isSupabaseConfigured || !authReady) return;
    const refreshPending = () => {
      void outboxSize(userId).then((pending) => setSyncStatus((s) => ({ ...s, pending })));
    };
    refreshPending();
    window.addEventListener(SYNC_QUEUE_EVENT, refreshPending);
    return () => window.removeEventListener(SYNC_QUEUE_EVENT, refreshPending);
  }, [authReady, userId]);

  const completeOnboarding = useCallback(async () => {
    await repo.markOnboarded(userId);
    setNeedsOnboarding(false);
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setSyncStatus((s) => ({ ...s, syncing: true }));
    try {
      const result = await sync(userId);
      const pending = await outboxSize(userId);
      const error =
        result.failed > 0
          ? "Some changes are still waiting to sync. We’ll keep trying."
          : result.skipped === "signed-out"
            ? "Sign in to sync across devices. Your data is still saved here."
            : null;
      setSyncStatus((s) => ({
        ...s,
        syncing: false,
        pending,
        lastSyncedAt: result.skipped || result.failed > 0 ? s.lastSyncedAt : new Date().toISOString(),
        lastSyncError: error,
      }));
      if (result.pulled > 0 && bootstrappedUser.current === userId) {
        const loaded = await repo.loadSnapshot(userId);
        if (bootstrappedUser.current === userId) setSnapshot(loaded);
      }
    } catch {
      const pending = await outboxSize(userId);
      setSyncStatus((s) => ({
        ...s,
        syncing: false,
        pending,
        lastSyncError: "Sync is unavailable right now. Your data is still saved on this device.",
      }));
    }
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !snapshot || !syncStatus.online) return;
    // Deferred rather than called inline: syncNow sets state, and doing that
    // synchronously inside an effect cascades an extra render on every mount.
    const first = setTimeout(() => void syncNow(), 0);
    const timer = setInterval(() => void syncNow(), 120_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [snapshot, syncNow, syncStatus.online]);

  const patch = useCallback((updater: (prev: Snapshot) => Snapshot) => {
    setSnapshot((prev) => (prev ? updater(prev) : prev));
  }, []);

  // --- derived state -------------------------------------------------------

  // Memoised so the identity is stable: every derived value below keys off
  // this array, and a fresh `[]` each render would recompute all of them.
  const subjectIds = useMemo(
    () => snapshot?.settings.subjectIds ?? [],
    [snapshot?.settings.subjectIds],
  );
  const topics = useMemo(() => allTopics(subjectIds), [subjectIds]);

  const mastery = useMemo(() => {
    if (!snapshot) return [];
    return computeTopicMastery({
      topics,
      cards: snapshot.cards,
      reviewLogs: snapshot.reviewLogs,
      attempts: snapshot.attempts,
      mistakes: snapshot.mistakes,
    });
  }, [snapshot, topics]);

  const recallMastery = useMemo(() => {
    if (!snapshot) return [];
    return computeRecallMastery({
      topics,
      cards: snapshot.cards,
      reviewLogs: snapshot.reviewLogs,
    });
  }, [snapshot, topics]);

  const masteryUncertainty = useMemo(() => {
    if (!snapshot) return [];

    const cardsByTopic = new Map<Id, Card[]>();
    for (const card of snapshot.cards) {
      const rows = cardsByTopic.get(card.topicId) ?? [];
      rows.push(card);
      cardsByTopic.set(card.topicId, rows);
    }

    const attemptsByTopic = new Map<Id, Attempt[]>();
    for (const attempt of snapshot.attempts) {
      for (const topicId of attempt.topicIds) {
        const rows = attemptsByTopic.get(topicId) ?? [];
        rows.push(attempt);
        attemptsByTopic.set(topicId, rows);
      }
    }

    const mistakesByTopic = new Map<Id, Mistake[]>();
    for (const mistake of snapshot.mistakes) {
      const rows = mistakesByTopic.get(mistake.topicId) ?? [];
      rows.push(mistake);
      mistakesByTopic.set(mistake.topicId, rows);
    }

    return masteryIntervals({
      masteryByTopic: new Map(mastery.map((row) => [row.topicId, row.mastery] as const)),
      cardsByTopic,
      attemptsByTopic,
      mistakesByTopic,
    });
  }, [snapshot, mastery]);

  const applicationMastery = useMemo(() => {
    if (!snapshot) return [];
    return computeApplicationMastery({
      topics,
      questions: snapshot.questions,
      attempts: snapshot.attempts,
    });
  }, [snapshot, topics]);

  const dueCards = useMemo(() => {
    if (!snapshot) return [];
    const today = todayIso();
    return snapshot.cards.filter((c) => subjectIds.includes(c.subjectId) && isDue(c, today));
  }, [snapshot, subjectIds]);

  const calibrationModel = useMemo(() => {
    if (!snapshot) {
      return buildCalibrationModel({ observations: [], predictionHistory: [], asOf: new Date().toISOString() });
    }
    const asOf = new Date().toISOString();
    const derivedObservations = observationsFromAttempts({ attempts: snapshot.attempts, asOf });
    return buildCalibrationModel({
      observations: [...snapshot.calibrationObservations, ...derivedObservations],
      predictionHistory: snapshot.predictionHistory,
      attempts: snapshot.attempts,
      questions: snapshot.questions,
      papers: snapshot.papers,
      subjects: allSubjects(),
      asOf,
    });
  }, [snapshot]);

  const assessment = useMemo(() => {
    if (!snapshot) return null;
    if (!snapshot.attempts.length && !snapshot.mistakes.length) return null;
    const questionsById = new Map(snapshot.questions.map((q) => [q.id, q] as const));
    return buildAssessmentInsight({
      attempts: snapshot.attempts,
      mistakes: snapshot.mistakes,
      mastery,
      questionsById,
      calibrationModel,
      asOf: calibrationModel.asOf,
    });
  }, [snapshot, mastery, calibrationModel]);

  const questionTraces = useMemo(() => {
    if (!snapshot) return [];
    const attemptsByQuestion = new Map<Id, Attempt[]>();
    for (const attempt of snapshot.attempts) {
      const rows = attemptsByQuestion.get(attempt.questionId) ?? [];
      rows.push(attempt);
      attemptsByQuestion.set(attempt.questionId, rows);
    }
    return traceQuestions({ questions: snapshot.questions, attemptsByQuestion });
  }, [snapshot]);
  const difficultyCalibration = useMemo(() => calibrateDifficulty(questionTraces), [questionTraces]);
  const calculationMastery = useMemo(() => {
    if (!snapshot) return calculateCalculationMastery({ questions: [], attempts: [], mistakes: [] });
    return calculateCalculationMastery({
      questions: snapshot.questions,
      attempts: snapshot.attempts,
      mistakes: snapshot.mistakes,
    });
  }, [snapshot]);
  const sparseEvidenceConfidence = useMemo(() => {
    if (!snapshot) return buildSparseEvidenceConfidence({ topics: [], mastery: [], cards: [], attempts: [], mistakes: [] });
    return buildSparseEvidenceConfidence({
      topics,
      mastery,
      cards: snapshot.cards,
      attempts: snapshot.attempts,
      mistakes: snapshot.mistakes,
    });
  }, [snapshot, topics, mastery]);
  const predictionOutcome = useMemo(() => {
    if (!snapshot) return predictionOutcomeReport([]);
    return predictionOutcomeReport(buildPredictionOutcomePairs({ attempts: snapshot.attempts, questions: snapshot.questions }));
  }, [snapshot]);
  const adaptiveDifficulty = useMemo(() => {
    if (!snapshot) return adaptiveDifficultyCalibration({ questions: [], traces: [] });
    return adaptiveDifficultyCalibration({ questions: snapshot.questions, traces: questionTraces });
  }, [snapshot, questionTraces]);
  const forgettingCalibration = useMemo(
    () => validateFsrs({ cards: snapshot?.cards ?? [], logs: snapshot?.reviewLogs ?? [] }),
    [snapshot],
  );
  const questionExposure = useMemo(() => {
    if (!snapshot) return questionExposureReport({ questions: [], attempts: [] });
    return questionExposureReport({ questions: snapshot.questions, attempts: snapshot.attempts });
  }, [snapshot]);

  const marksPerHour = useMemo(() => {
    if (!assessment) return new Map<Id, number>();
    return new Map(assessment.expectedMarksPerHour.map((r) => [r.topicId, r.value] as const));
  }, [assessment]);
  const rootPrerequisiteRemediation = useMemo(
    () => buildRootPrerequisiteRemediation({ topics, mastery, marksPerHour }),
    [topics, mastery, marksPerHour],
  );

  const recurringMisconceptions = useMemo(
    () => (snapshot ? tallyMisconceptions(snapshot.mistakes, seedMisconceptions) : []),
    [snapshot],
  );
  const errorModel = useMemo(
    () => (snapshot ? buildErrorModel({ mistakes: snapshot.mistakes }) : []),
    [snapshot],
  );
  const recentWorkloadMinutes = useMemo<Record<string, number>>(() => {
    if (!snapshot) return {};
    const planned: Record<string, number> = {};
    for (const session of snapshot.plannedSessions) {
      if (session.status !== "done") continue;
      const date = session.completedAt?.slice(0, 10) ?? session.date;
      planned[date] = (planned[date] ?? 0) + session.minutes;
    }
    const observed: Record<string, number> = {};
    for (const log of snapshot.reviewLogs) {
      const date = log.reviewedAt.slice(0, 10);
      observed[date] = (observed[date] ?? 0) + Math.max(0, log.elapsedMs) / 60_000;
    }
    for (const attempt of snapshot.attempts) {
      const date = attempt.createdAt.slice(0, 10);
      observed[date] = (observed[date] ?? 0) + Math.max(0, attempt.elapsedMs) / 60_000;
    }
    const totals: Record<string, number> = {};
    for (const date of new Set([...Object.keys(planned), ...Object.keys(observed)])) {
      totals[date] = Math.max(planned[date] ?? 0, observed[date] ?? 0);
    }
    return totals;
  }, [snapshot]);

  // Dynamic replanning: when an input the plan depends on changes (exam date,
  // target grade, availability, session length or subject set), rebuild the
  // pending future sessions automatically and say why. The fingerprint lives
  // in a ref so replanning never triggers an extra render.
  useEffect(() => {
    if (!snapshot) return;
    const current = computeFingerprint({
      exams: snapshot.examDates,
      targetGrades: snapshot.settings.targetGrades,
      availability: snapshot.settings.availability,
      availabilityOverrides: snapshot.settings.availabilityOverrides,
      sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
      subjectIds: snapshot.settings.subjectIds,
      learnerStateKey: learnerStateKey({
        mastery,
        cards: snapshot.cards,
        mistakes: snapshot.mistakes,
        attempts: snapshot.attempts,
      }),
    });
    if (lastFingerprint.current === null) {
      lastFingerprint.current = current;
      return;
    }
    if (fingerprintKey(current) === fingerprintKey(lastFingerprint.current)) return;
    const previous = lastFingerprint.current;
    lastFingerprint.current = current;
    let cancelled = false;
    void (async () => {
      const result = replanDynamically({
        userId,
        topics,
        subjects: allSubjects().filter((s) => snapshot.settings.subjectIds.includes(s.id)),
        mastery,
        exams: snapshot.examDates,
        availability: snapshot.settings.availability,
        availabilityOverrides: snapshot.settings.availabilityOverrides,
        sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
        subjectIds: snapshot.settings.subjectIds,
        targetGrades: snapshot.settings.targetGrades,
        calibrationModel,
        cards: snapshot.cards,
        mistakes: snapshot.mistakes,
        attempts: snapshot.attempts,
        errorModel,
        learnerStateKey: current.learner,
        recentWorkloadMinutes,
        fatigueThresholdDays: 3,
        existing: snapshot.plannedSessions,
        previous,
      });
      if (cancelled) return;
      if (result.changed) {
        await repo.replacePlan(userId, result.plan);
        if (cancelled) return;
        setSnapshot((prev) => (prev ? { ...prev, plannedSessions: result.plan } : prev));
      }
      setReplanSummary(result.summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot, userId, topics, mastery, calibrationModel, errorModel, recentWorkloadMinutes]);

  // Calibration is learned only from predictions captured before a paper and
  // completed with its later result. Reconstructing a prediction from current
  // mastery after the paper would leak future information, so it is excluded.
  const calibrations = useMemo(() => {
    const out = new Map<Id, Calibration>();
    for (const [subjectId, paperModel] of calibrationModel.paperBySubject) {
      const report = evaluatePaperCalibration({
        records: snapshot?.predictionHistory ?? [],
        asOf: calibrationModel.asOf,
        subjectId,
      });
      out.set(subjectId, {
        subjectId,
        bias: report.sampleSize ? report.metrics.bias : paperModel.bias,
        slope: report.metrics.calibrationSlope ?? paperModel.slope,
        sampleSize: report.sampleSize,
        mae: report.sampleSize ? report.metrics.mae : paperModel.mae,
        modelVersion: paperModel.modelVersion,
        priorVersion: paperModel.priorVersion,
        source: paperModel.source,
        biasLower: paperModel.biasLower,
        biasUpper: paperModel.biasUpper,
        intervalCoverage: report.metrics.intervalCoverage,
        ece: report.metrics.ece,
      });
    }
    // Ensure every enrolled subject has at least a neutral calibration
    for (const sid of subjectIds) {
      if (!out.has(sid)) {
        out.set(sid, {
          subjectId: sid,
          bias: 0,
          slope: 1,
          sampleSize: 0,
          mae: 0,
          modelVersion: calibrationModel.modelVersion,
          priorVersion: calibrationModel.priorVersion,
          source: "population-prior",
          biasLower: -CALIBRATION_PRIOR_V1.paperCalibration.residualStandardDeviation,
          biasUpper: CALIBRATION_PRIOR_V1.paperCalibration.residualStandardDeviation,
        });
      }
    }
    return out;
  }, [calibrationModel, subjectIds, snapshot?.predictionHistory]);

  const responseTimeCalibration = useMemo(
    () =>
      buildResponseTimeCalibration({
        attempts: snapshot?.attempts ?? [],
        questions: snapshot?.questions ?? [],
        papers: snapshot?.papers ?? [],
        subjects: allSubjects().filter((subject) => subjectIds.includes(subject.id)),
      }),
    [snapshot, subjectIds],
  );

  const recommendations = useMemo(() => {
    if (!snapshot) return [];
    const marksPerHourEstimates = new Map(
      topics.map((topic) => [topic.id, estimateMarksPerHour(calibrationModel, topic.id, topic.subjectId)] as const),
    );
    const recoverableFractionEstimates = new Map(
      subjectIds.map((subjectId) => [subjectId, estimateRecoverableMarks(calibrationModel, "", subjectId)] as const),
    );
    return recommend({
      topics,
      mastery,
      cards: snapshot.cards,
      mistakes: snapshot.mistakes,
      errorModel,
      exams: snapshot.examDates,
      plan: snapshot.plannedSessions,
      sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
      subjectIds,
      marksPerHour,
      marksPerHourEstimates,
      recoverableFractionEstimates,
    });
  }, [snapshot, mastery, topics, subjectIds, marksPerHour, calibrationModel, errorModel]);

  const predictions = useMemo(() => {
    if (!snapshot) return [];
    return subjectIds
      .map((id) => getSubject(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((subject) => predictGrade(subject, mastery, snapshot.attempts, snapshot.examDates, calibrationModel.asOf.slice(0, 10), calibrationModel));
  }, [snapshot, mastery, subjectIds, calibrationModel]);

  const previewPaper = useCallback(
    (subjectId: Id, paperSpecId: Id, questionIds: Id[]): PaperSimulation | null => {
      if (!snapshot) return null;
      const subject = getSubject(subjectId);
      if (!subject) return null;
      const questions = questionIds.map((id) => snapshot.questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q));
      if (!questions.length) return null;
      const topicMastery = new Map(mastery.map((m) => [m.topicId, m.mastery]));
      // The timestamped calibration model is the production path. The
      // `calibration` argument remains only as a compatibility adapter for
      // older callers/tests and would discard the model's uncertainty band.
      return simulatePaper({ subject, paperSpecId, questions, topicMastery, calibrationModel, asOf: calibrationModel.asOf });
    },
    [snapshot, mastery, calibrationModel],
  );

  // --- actions -------------------------------------------------------------

  const bumpGamification = useCallback(
    async (current: StreakState, xp: number, statsPatch: Partial<GamificationStats>, snap: Snapshot) => {
      const today = todayIso();
      let next = touchStreak(current, today);
      next = addXp(next, xp);
      const stats: GamificationStats = {
        reviews: snap.reviewLogs.length,
        attempts: snap.attempts.length,
        marksEarned: snap.attempts.reduce((a, x) => a + x.awarded, 0),
        papers: snap.papers.filter((p) => p.status === "practised").length,
        streak: next.current,
        masteredTopics: mastery.filter((m) => m.mastery >= 0.8).length,
        perfectSessions: 0,
        ...statsPatch,
      };
      const unlocked = newlyUnlocked(next.achievements, stats);
      if (unlocked.length) next = { ...next, achievements: unlockedAchievements(stats) };
      await repo.saveStreak(next);
      return next;
    },
    [mastery],
  );

  const reviewCard = useCallback<StoreValue["reviewCard"]>(
    async (card, grade, elapsedMs, confidence) => {
      const now = new Date();
      const updated = gradeCard(card, grade, now);
      const log: ReviewLog = {
        id: crypto.randomUUID(),
        userId,
        cardId: card.id,
        topicId: card.topicId,
        grade,
        confidence,
        elapsedMs,
        reviewedAt: now.toISOString(),
      };
      await repo.saveCard(updated);
      await repo.saveReviewLog(log);

      // A mistake card that has been recalled reliably closes its mistake.
      let resolvedMistakes: Mistake[] = [];
      if (updated.sourceMistakeId && shouldResolve(updated)) {
        const mistake = snapshot?.mistakes.find((m) => m.id === updated.sourceMistakeId);
        if (mistake && !mistake.resolved) {
          const closed = { ...mistake, resolved: true, resolvedAt: now.toISOString() };
          await repo.saveMistake(closed);
          resolvedMistakes = [closed];
        }
      }

      setSnapshot((prev) => {
        if (!prev) return prev;
        const next: Snapshot = {
          ...prev,
          cards: prev.cards.map((c) => (c.id === updated.id ? updated : c)),
          reviewLogs: [...prev.reviewLogs, log],
          mistakes: resolvedMistakes.length
            ? prev.mistakes.map((m) => resolvedMistakes.find((r) => r.id === m.id) ?? m)
            : prev.mistakes,
        };
        void bumpGamification(
          prev.streak,
          grade === "again" ? XP.review : XP.correctReview + (resolvedMistakes.length ? XP.mistakeResolved : 0),
          {},
          next,
        ).then((streak) => patch((p) => ({ ...p, streak })));
        return next;
      });
    },
    [userId, snapshot, bumpGamification, patch],
  );

  const recordAttempt = useCallback<StoreValue["recordAttempt"]>(
    async (attempt, question) => {
      const isRetest = Boolean(attempt.retestMistakeId);
      const retestMistake = isRetest
        ? snapshot?.mistakes.find((mistake) => mistake.id === attempt.retestMistakeId && !mistake.resolved)
        : undefined;
      if (isRetest && !retestMistake) {
        throw new Error("Cannot retest an unavailable or already resolved mistake.");
      }
      const retestEvaluation = retestMistake ? evaluateMistakeRetest(retestMistake, question, attempt) : undefined;
      const updatedMistake = retestMistake && retestEvaluation
        ? applyRetestToMistake(retestMistake, retestEvaluation, attempt)
        : undefined;

      await repo.saveAttempt(attempt);
      if (updatedMistake) await repo.saveMistake(updatedMistake);

      // Materialise a transfer observation when this outcome has a captured,
      // earlier revision context. Missing context is intentionally ignored;
      // current mastery is never used to reconstruct an old baseline.
      const priorAttempts = snapshot?.attempts ?? [];
      const revision = [...priorAttempts]
        .reverse()
        .find((candidate) =>
          candidate.subjectId === attempt.subjectId &&
          candidate.calibrationContext &&
          candidate.createdAt < attempt.createdAt &&
          candidate.topicIds.some((topicId) => attempt.topicIds.includes(topicId)),
        );
      if (revision) {
        const topicId = revision.topicIds.find((candidate) => attempt.topicIds.includes(candidate)) ?? attempt.topicIds[0];
        if (topicId) {
          const observation = observationFromRevisionAndOutcome({
            id: `${revision.id}:${attempt.id}:${topicId}`,
            revision,
            outcome: attempt,
            topicId,
          });
          if (observation) {
            await repo.saveCalibrationObservation(observation);
          }
        }
      }

      // A failed retest updates the original mistake in place. It must not
      // create another card for the same gap.
      const misconceptions = [...new Set(question.topicIds.flatMap((id) => misconceptionsForTopic(id)))];
      const drafts = isRetest ? [] : mistakesFromAttempt(attempt, question, undefined, undefined, misconceptions);
      if (drafts.length) {
        await repo.saveMistakes(drafts.map((d) => d.mistake));
        await repo.saveCards(drafts.map((d) => d.card));
      }
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next: Snapshot = {
          ...prev,
          attempts: [...prev.attempts, attempt],
          calibrationObservations: revision
            ? (() => {
                const topicId = revision.topicIds.find((candidate) => attempt.topicIds.includes(candidate)) ?? attempt.topicIds[0];
                if (!topicId) return prev.calibrationObservations;
                const id = `${revision.id}:${attempt.id}:${topicId}`;
                const observation = observationFromRevisionAndOutcome({ id, revision, outcome: attempt, topicId });
                return observation
                  ? [...prev.calibrationObservations.filter((row) => row.id !== observation.id), observation]
                  : prev.calibrationObservations;
              })()
            : prev.calibrationObservations,
          mistakes: updatedMistake
            ? prev.mistakes.map((mistake) => (mistake.id === updatedMistake.id ? updatedMistake : mistake))
            : [...prev.mistakes, ...drafts.map((d) => d.mistake)],
          cards: [...prev.cards, ...drafts.map((d) => d.card)],
        };
        const retestXp = retestEvaluation?.status === "resolved" ? XP.mistakeResolved : 0;
        void bumpGamification(prev.streak, attempt.awarded * XP.attemptMark + retestXp, {}, next).then((streak) =>
          patch((p) => ({ ...p, streak })),
        );
        return next;
      });
      return updatedMistake ? [updatedMistake] : drafts.map((d) => d.mistake);
    },
    [bumpGamification, patch, snapshot],
  );

  const recordCalibrationObservation = useCallback<StoreValue["recordCalibrationObservation"]>(
    async (observation) => {
      await repo.saveCalibrationObservation(observation);
      patch((prev) => ({
        ...prev,
        calibrationObservations: [...prev.calibrationObservations.filter((row) => row.id !== observation.id), observation],
      }));
    },
    [patch],
  );

  const recordPredictionHistory = useCallback<StoreValue["recordPredictionHistory"]>(
    async (record) => {
      await repo.savePredictionHistory(record);
      patch((prev) => ({
        ...prev,
        predictionHistory: [...prev.predictionHistory.filter((row) => row.id !== record.id), record],
      }));
    },
    [patch],
  );

  const completePredictionHistory = useCallback<StoreValue["completePredictionHistory"]>(
    async (id, outcome) => {
      const current = snapshot?.predictionHistory.find((record) => record.id === id);
      if (!current || current.outcomeAt) return;
      const updated: PredictionHistoryRecord = {
        ...current,
        outcomeMarks: Math.max(0, Math.min(outcome.marks, outcome.totalMarks)),
        outcomeTotalMarks: Math.max(0, outcome.totalMarks),
        outcomeAt: outcome.at,
        updatedAt: outcome.at,
      };
      await repo.savePredictionHistory(updated);
      patch((prev) => ({
        ...prev,
        predictionHistory: prev.predictionHistory.map((record) => (record.id === id ? updated : record)),
      }));
    },
    [patch, snapshot],
  );

  const addCards = useCallback<StoreValue["addCards"]>(
    async (cards) => {
      if (!cards.length) return;
      await repo.saveCards(cards);
      patch((prev) => ({ ...prev, cards: [...prev.cards, ...cards] }));
    },
    [patch],
  );

  const removeCard = useCallback<StoreValue["removeCard"]>(
    async (id) => {
      await repo.deleteCard(id, userId);
      patch((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }));
    },
    [patch, userId],
  );

  const updateCards = useCallback<StoreValue["updateCards"]>(
    async (updated) => {
      if (!updated.length) return;
      await repo.saveCards(updated);
      const byId = new Map(updated.map((c) => [c.id, c]));
      patch((prev) => ({ ...prev, cards: prev.cards.map((c) => byId.get(c.id) ?? c) }));
    },
    [patch],
  );

  const removeCards = useCallback<StoreValue["removeCards"]>(
    async (ids) => {
      if (!ids.length) return;
      await repo.deleteCards(ids, userId);
      const gone = new Set(ids);
      patch((prev) => ({ ...prev, cards: prev.cards.filter((c) => !gone.has(c.id)) }));
    },
    [patch, userId],
  );

  const addQuestions = useCallback<StoreValue["addQuestions"]>(
    async (questions) => {
      if (!questions.length) return;
      const ownedQuestions = questions.map((question) =>
        question.origin === "seed" ? question : { ...question, userId },
      );
      await repo.saveQuestions(ownedQuestions, userId);
      patch((prev) => ({ ...prev, questions: [...prev.questions, ...ownedQuestions] }));
    },
    [patch, userId],
  );

  const addPaper = useCallback<StoreValue["addPaper"]>(
    async (paper) => {
      await repo.savePaper(paper);
      patch((prev) => ({
        ...prev,
        papers: [...prev.papers.filter((p) => p.id !== paper.id), paper],
      }));
    },
    [patch],
  );

  const regeneratePlan = useCallback<StoreValue["regeneratePlan"]>(async () => {
    if (!snapshot) return;
    const subjects = allSubjects().filter((s) => snapshot.settings.subjectIds.includes(s.id));
    const plan = buildPlan({
      userId,
      topics,
      mastery,
      exams: snapshot.examDates,
      availability: snapshot.settings.availability,
      availabilityOverrides: snapshot.settings.availabilityOverrides,
      sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
      subjectIds: snapshot.settings.subjectIds,
      subjects,
      targetGrades: snapshot.settings.targetGrades,
      calibrationModel,
      cards: snapshot.cards,
      mistakes: snapshot.mistakes,
      attempts: snapshot.attempts,
      errorModel,
      recentWorkloadMinutes,
      fatigueThresholdDays: 3,
      existing: snapshot.plannedSessions,
    });
    await repo.replacePlan(userId, plan);
    patch((prev) => ({ ...prev, plannedSessions: plan }));
  }, [snapshot, userId, topics, mastery, calibrationModel, errorModel, recentWorkloadMinutes, patch]);

  const rescheduleMissedSessions = useCallback<StoreValue["rescheduleMissedSessions"]>(async () => {
    if (!snapshot) return;
    const healed = rescheduleMissedPrioritised(
      snapshot.plannedSessions,
      todayIso(),
      6,
      mastery,
      snapshot.examDates,
    );
    await repo.replacePlan(userId, healed);
    patch((prev) => ({ ...prev, plannedSessions: healed }));
  }, [snapshot, userId, mastery, patch]);

  const completeSession = useCallback<StoreValue["completeSession"]>(
    async (sessionId, status = "done") => {
      const session = snapshot?.plannedSessions.find((s) => s.id === sessionId);
      if (!session) return;
      const updated: PlannedSession = {
        ...session,
        status,
        completedAt: status === "done" ? new Date().toISOString() : undefined,
      };
      await repo.savePlan([updated]);
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next: Snapshot = {
          ...prev,
          plannedSessions: prev.plannedSessions.map((s) => (s.id === sessionId ? updated : s)),
        };
        if (status === "done") {
          void bumpGamification(prev.streak, XP.sessionCompleted, {}, next).then((streak) =>
            patch((p) => ({ ...p, streak })),
          );
        }
        return next;
      });
    },
    [snapshot, bumpGamification, patch],
  );

  const upsertExamDate = useCallback<StoreValue["upsertExamDate"]>(
    async (exam) => {
      await repo.saveExamDate(exam);
      patch((prev) => ({
        ...prev,
        examDates: [...prev.examDates.filter((e) => e.id !== exam.id), exam],
      }));
    },
    [patch],
  );

  const removeExamDate = useCallback<StoreValue["removeExamDate"]>(
    async (id) => {
      await repo.deleteExamDate(id, userId);
      patch((prev) => ({ ...prev, examDates: prev.examDates.filter((e) => e.id !== id) }));
    },
    [patch, userId],
  );

  const updateSettings = useCallback<StoreValue["updateSettings"]>(
    async (patchValue) => {
      if (!snapshot) return;
      const next: UserSettings = { ...snapshot.settings, ...patchValue, updatedAt: new Date().toISOString() };
      await repo.saveSettings(next);
      patch((prev) => ({ ...prev, settings: next }));
    },
    [snapshot, patch],
  );

  const saveRevisionCheckpoint = useCallback<StoreValue["saveRevisionCheckpoint"]>(
    async (input) => {
      const checkpoint = createRevisionCheckpoint(userId, input);
      await repo.saveRevisionCheckpoint(checkpoint);
      setRevisionCheckpoint(checkpoint);
    },
    [userId],
  );

  const clearRevisionCheckpoint = useCallback<StoreValue["clearRevisionCheckpoint"]>(async () => {
    await repo.clearRevisionCheckpoint(userId);
    setRevisionCheckpoint(null);
  }, [userId]);

  const value: StoreValue | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      ...snapshot,
      ready: true,
      needsOnboarding,
      completeOnboarding,
      userId,
      mastery,
      masteryUncertainty,
      applicationMastery,
      recallMastery,
      recommendations,
      predictions,
      dueCards,
      assessment,
      marksPerHour,
      calibrationModel,
      recurringMisconceptions,
      errorModel,
      replanSummary,
      calibrations,
      questionTraces,
      difficultyCalibration,
      calculationMastery,
      sparseEvidenceConfidence,
      predictionOutcome,
      adaptiveDifficulty,
      forgettingCalibration,
      questionExposure,
      rootPrerequisiteRemediation,
      revisionCheckpoint,
      responseTimeCalibration,
      previewPaper,
      syncStatus,
      reviewCard,
      recordAttempt,
      recordCalibrationObservation,
      recordPredictionHistory,
      completePredictionHistory,
      addCards,
      removeCard,
      updateCards,
      removeCards,
      addQuestions,
      addPaper,
      regeneratePlan,
      rescheduleMissedSessions,
      completeSession,
      upsertExamDate,
      removeExamDate,
      updateSettings,
      saveRevisionCheckpoint,
      clearRevisionCheckpoint,
      syncNow,
    };
  }, [
    snapshot,
    needsOnboarding,
    completeOnboarding,
    userId,
    mastery,
    masteryUncertainty,
    applicationMastery,
    recallMastery,
    recommendations,
    predictions,
    dueCards,
    assessment,
    marksPerHour,
    calibrationModel,
    recurringMisconceptions,
    errorModel,
    replanSummary,
    calibrations,
    questionTraces,
    difficultyCalibration,
    calculationMastery,
    sparseEvidenceConfidence,
    predictionOutcome,
    adaptiveDifficulty,
    forgettingCalibration,
    questionExposure,
    rootPrerequisiteRemediation,
    revisionCheckpoint,
    responseTimeCalibration,
    previewPaper,
    syncStatus,
    reviewCard,
    recordAttempt,
    recordCalibrationObservation,
    recordPredictionHistory,
    completePredictionHistory,
    addCards,
    removeCard,
    updateCards,
    removeCards,
    addQuestions,
    addPaper,
    regeneratePlan,
    rescheduleMissedSessions,
    completeSession,
    upsertExamDate,
    removeExamDate,
    updateSettings,
    saveRevisionCheckpoint,
    clearRevisionCheckpoint,
    syncNow,
  ]);

  if (!value) return <BootScreen />;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function BootScreen() {
  return (
    <div className="min-h-dvh grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-ink3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <p className="text-sm">Loading your revision data…</p>
      </div>
    </div>
  );
}

/** Subjects the student is taking, in curriculum order. */
export function useSubjects() {
  const { settings } = useStore();
  return useMemo(
    () => allSubjects().filter((s) => settings.subjectIds.includes(s.id)),
    [settings.subjectIds],
  );
}
