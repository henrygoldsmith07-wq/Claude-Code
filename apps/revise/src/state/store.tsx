"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { allSubjects, allTopics, getSubject } from "@/domain/curriculum";
import { predictGrade } from "@/domain/grades";
import type { GradePrediction } from "@/domain/grades";
import { computeTopicMastery } from "@/domain/mastery";
import { computeApplicationMastery } from "@/domain/application-mastery";
import { computeRecallMastery } from "@/domain/recall-mastery";
import { mistakesFromAttempt, shouldResolve } from "@/domain/mistakes";
import { buildPlan, rescheduleMissed } from "@/domain/planner";
import { recommend } from "@/domain/recommender";
import { gradeCard, isDue, todayIso } from "@/domain/scheduling";
import { addXp, newlyUnlocked, touchStreak, unlockedAchievements, XP } from "@/domain/gamification";
import { buildAssessmentInsight, calibrateFromHistory, simulatePaper } from "@/domain/assessment";
import type {
  AssessmentInsight,
  Attempt,
  Calibration,
  Card,
  ExamDate,
  GamificationStats,
  Id,
  Mistake,
  Paper,
  PaperSimulation,
  PlannedSession,
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
import * as repo from "@/data/repository";
import { LOCAL_USER_ID } from "@/data/repository";
import type { Snapshot } from "@/data/repository";
import { outboxSize, sync } from "@/data/sync";
import { isSupabaseConfigured } from "@/data/supabase";

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
  applicationMastery: ApplicationMasteryRow[];
  recallMastery: RecallMasteryRow[];
  recommendations: Recommendation[];
  predictions: GradePrediction[];
  dueCards: Card[];
  assessment: AssessmentInsight | null;
  /** Expected exam marks gained per study hour, keyed by topic. The metric the brief asks for. */
  marksPerHour: Map<Id, number>;
  calibrations: Map<Id, Calibration>;
  syncStatus: SyncStatus;
  /** Build a paper simulation for the given subject/paper without mutating state. */
  previewPaper(subjectId: Id, paperSpecId: Id, questionIds: Id[]): PaperSimulation | null;
  // actions
  reviewCard(card: Card, grade: RecallGrade, elapsedMs: number, confidence?: 1 | 2 | 3 | 4 | 5): Promise<void>;
  recordAttempt(attempt: Attempt, question: Question): Promise<Mistake[]>;
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
  syncNow(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}

export function StoreProvider({ children, userId = LOCAL_USER_ID }: { children: ReactNode; userId?: Id }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    online: true,
    pending: 0,
    lastSyncedAt: null,
    enabled: isSupabaseConfigured,
    syncing: false,
  });
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      const loaded = await repo.loadSnapshot(userId);
      setSnapshot(loaded);
      setNeedsOnboarding(!(await repo.hasOnboarded()));
      // A plan that has drifted into the past is worse than no plan: fold
      // missed sessions forward before the dashboard renders anything.
      const today = todayIso();
      const stale = loaded.plannedSessions.some((s) => s.date < today && s.status === "pending");
      if (stale) {
        const healed = rescheduleMissed(loaded.plannedSessions, today, 6);
        await repo.savePlan(healed);
        setSnapshot((prev) => (prev ? { ...prev, plannedSessions: healed } : prev));
      }
    })();
  }, [userId]);

  // Network status drives the offline banner and gates sync attempts.
  useEffect(() => {
    const update = () => setSyncStatus((s) => ({ ...s, online: navigator.onLine }));
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await repo.markOnboarded();
    setNeedsOnboarding(false);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setSyncStatus((s) => ({ ...s, syncing: true }));
    const result = await sync(userId);
    const pending = await outboxSize();
    setSyncStatus((s) => ({
      ...s,
      syncing: false,
      pending,
      lastSyncedAt: result.skipped ? s.lastSyncedAt : new Date().toISOString(),
    }));
    if (result.pulled > 0) setSnapshot(await repo.loadSnapshot(userId));
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !snapshot) return;
    // Deferred rather than called inline: syncNow sets state, and doing that
    // synchronously inside an effect cascades an extra render on every mount.
    const first = setTimeout(() => void syncNow(), 0);
    const timer = setInterval(() => void syncNow(), 120_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [snapshot, syncNow]);

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

  const assessment = useMemo(() => {
    if (!snapshot) return null;
    if (!snapshot.attempts.length && !snapshot.mistakes.length) return null;
    const questionsById = new Map(snapshot.questions.map((q) => [q.id, q] as const));
    return buildAssessmentInsight({
      attempts: snapshot.attempts,
      mistakes: snapshot.mistakes,
      mastery,
      questionsById,
    });
  }, [snapshot, mastery]);

  const marksPerHour = useMemo(() => {
    if (!assessment) return new Map<Id, number>();
    return new Map(assessment.expectedMarksPerHour.map((r) => [r.topicId, r.value] as const));
  }, [assessment]);

  // Calibration per subject from paper-mode attempts: predicted vs actual.
  // Paper attempts are the only ones with a stable "total marks" denominator.
  const calibrations = useMemo(() => {
    if (!snapshot) return new Map<Id, Calibration>();
    const bySubject = new Map<Id, Array<{ predicted: number; actual: number }>>();
    const masteryMap = new Map(mastery.map((m) => [m.topicId, m.mastery]));
    // Group paper-mode attempts by subject; use current mastery as a proxy for predicted %
    // until real simulations are stored. This still yields a meaningful bias once ≥3 papers exist.
    for (const a of snapshot.attempts.filter((x) => x.mode === "paper")) {
      const q = snapshot.questions.find((qq) => qq.id === a.questionId);
      const subjectId = a.subjectId;
      // predicted marks for this attempt: sum of topic mastery averaged across its topics
      const qMastery = q ? q.topicIds.reduce((s, id) => s + (masteryMap.get(id) ?? 0.4), 0) / Math.max(1, q.topicIds.length) : 0.4;
      const predicted = a.max * (0.35 + qMastery * 0.6);
      const list = bySubject.get(subjectId) ?? [];
      list.push({ predicted, actual: a.awarded });
      bySubject.set(subjectId, list);
    }
    const out = new Map<Id, Calibration>();
    for (const [subjectId, pairs] of bySubject) {
      out.set(subjectId, calibrateFromHistory({ subjectId, pairs }));
    }
    // Ensure every enrolled subject has at least a neutral calibration
    for (const sid of subjectIds) if (!out.has(sid)) out.set(sid, { subjectId: sid, bias: 0, slope: 1, sampleSize: 0, mae: 0 });
    return out;
  }, [snapshot, mastery, subjectIds]);

  const recommendations = useMemo(() => {
    if (!snapshot) return [];
    return recommend({
      topics,
      mastery,
      cards: snapshot.cards,
      mistakes: snapshot.mistakes,
      exams: snapshot.examDates,
      plan: snapshot.plannedSessions,
      sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
      subjectIds,
      marksPerHour,
    });
  }, [snapshot, mastery, topics, subjectIds, marksPerHour]);

  const predictions = useMemo(() => {
    if (!snapshot) return [];
    return subjectIds
      .map((id) => getSubject(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((subject) => predictGrade(subject, mastery, snapshot.attempts, snapshot.examDates));
  }, [snapshot, mastery, subjectIds]);

  const previewPaper = useCallback(
    (subjectId: Id, paperSpecId: Id, questionIds: Id[]): PaperSimulation | null => {
      if (!snapshot) return null;
      const subject = getSubject(subjectId);
      if (!subject) return null;
      const questions = questionIds.map((id) => snapshot.questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q));
      if (!questions.length) return null;
      const topicMastery = new Map(mastery.map((m) => [m.topicId, m.mastery]));
      return simulatePaper({ subject, paperSpecId, questions, topicMastery, calibration: calibrations.get(subjectId) });
    },
    [snapshot, mastery, calibrations],
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
      await repo.saveAttempt(attempt);
      const drafts = mistakesFromAttempt(attempt, question);
      if (drafts.length) {
        await repo.saveMistakes(drafts.map((d) => d.mistake));
        await repo.saveCards(drafts.map((d) => d.card));
      }
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next: Snapshot = {
          ...prev,
          attempts: [...prev.attempts, attempt],
          mistakes: [...prev.mistakes, ...drafts.map((d) => d.mistake)],
          cards: [...prev.cards, ...drafts.map((d) => d.card)],
        };
        void bumpGamification(prev.streak, attempt.awarded * XP.attemptMark, {}, next).then((streak) =>
          patch((p) => ({ ...p, streak })),
        );
        return next;
      });
      return drafts.map((d) => d.mistake);
    },
    [bumpGamification, patch],
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
      await repo.deleteCard(id);
      patch((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }));
    },
    [patch],
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
      await repo.deleteCards(ids);
      const gone = new Set(ids);
      patch((prev) => ({ ...prev, cards: prev.cards.filter((c) => !gone.has(c.id)) }));
    },
    [patch],
  );

  const addQuestions = useCallback<StoreValue["addQuestions"]>(
    async (questions) => {
      if (!questions.length) return;
      await repo.saveQuestions(questions);
      patch((prev) => ({ ...prev, questions: [...prev.questions, ...questions] }));
    },
    [patch],
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
    const plan = buildPlan({
      userId,
      topics,
      mastery,
      exams: snapshot.examDates,
      availability: snapshot.settings.availability,
      sessionLengthMinutes: snapshot.settings.sessionLengthMinutes,
      subjectIds: snapshot.settings.subjectIds,
      existing: snapshot.plannedSessions,
    });
    await repo.replacePlan(userId, plan);
    patch((prev) => ({ ...prev, plannedSessions: plan }));
  }, [snapshot, userId, topics, mastery, patch]);

  const rescheduleMissedSessions = useCallback<StoreValue["rescheduleMissedSessions"]>(async () => {
    if (!snapshot) return;
    const healed = rescheduleMissed(snapshot.plannedSessions, todayIso(), 6);
    await repo.replacePlan(userId, healed);
    patch((prev) => ({ ...prev, plannedSessions: healed }));
  }, [snapshot, userId, patch]);

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
      await repo.deleteExamDate(id);
      patch((prev) => ({ ...prev, examDates: prev.examDates.filter((e) => e.id !== id) }));
    },
    [patch],
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

  const value: StoreValue | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      ...snapshot,
      ready: true,
      needsOnboarding,
      completeOnboarding,
      userId,
      mastery,
      applicationMastery,
      recallMastery,
      recommendations,
      predictions,
      dueCards,
      assessment,
      marksPerHour,
      calibrations,
      previewPaper,
      syncStatus,
      reviewCard,
      recordAttempt,
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
      syncNow,
    };
  }, [
    snapshot,
    needsOnboarding,
    completeOnboarding,
    userId,
    mastery,
    applicationMastery,
    recallMastery,
    recommendations,
    predictions,
    dueCards,
    assessment,
    marksPerHour,
    calibrations,
    previewPaper,
    syncStatus,
    reviewCard,
    recordAttempt,
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
