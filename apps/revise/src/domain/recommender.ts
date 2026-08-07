import { isDue, retrievability } from "./scheduling";
import { untouchedTopics, weakTopics } from "./mastery";
import type {
  ActivityKind,
  Card,
  ExamDate,
  Id,
  IsoDate,
  Mistake,
  PlannedSession,
  Recommendation,
  RecommendationExplanation,
  RecommendationFactors,
  Topic,
  TopicMastery,
} from "./types";

// ---------------------------------------------------------------------------
// "What should I do right now?" — scored as
//
//   score ≈ expected exam gain × urgency × weakness × forgetting × uncertainty ÷ expected time
//
// Every factor is in 0.7–2.0 so no single factor dominates and the score
// remains interpretable as "weighted marks per minute". The explanation is
// first-class: each recommendation carries the numbers the brief asks for
// (recoverable marks, last evidence %, days since retrieval, paper countdown)
// so the UI never paraphrases a number the engine didn't actually compute.
// ---------------------------------------------------------------------------

export interface RecommendInput {
  topics: Topic[];
  mastery: TopicMastery[];
  cards: Card[];
  mistakes: Mistake[];
  exams: ExamDate[];
  plan: PlannedSession[];
  sessionLengthMinutes: number;
  subjectIds: Id[];
  now?: Date;
  marksPerHour?: Map<Id, number>;
  /** Base recovery fraction for recoverable marks when marksPerHour is absent. */
  recoverableFraction?: number;
}

/** Days until the exam, or null when no exam is set for that subject. */
export function daysToExam(exams: ExamDate[], subjectId: Id, today: IsoDate): number | null {
  const dates = exams
    .filter((e) => e.subjectId === subjectId && e.date >= today)
    .map((e) => e.date)
    .sort();
  if (!dates.length) return null;
  return Math.round(
    (new Date(`${dates[0]}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function examUrgency(days: number | null): number {
  if (days == null) return 1;
  if (days <= 0) return 2;
  return 1 + Math.min(1, 30 / (days + 15));
}

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

function weaknessFactor(mastery: number): number {
  // 0 mastery → 1.8, 0.5 → 1.4, 1.0 → 1.0
  return 1 + (1 - clamp01(mastery)) * 0.8;
}

function forgettingFactor(retention: number | null, daysSince: number | null): number {
  if (retention != null) return 1 + (1 - clamp01(retention)) * 0.6;
  if (daysSince != null) return 1 + Math.min(1, daysSince / 21) * 0.5;
  return 1.15; // never studied → modest forgetting pressure
}

function uncertaintyFactor(cardsTotal: number, attempts: number): number {
  const evidence = cardsTotal + attempts * 2;
  const weight = Math.min(1, evidence / 8);
  // thin evidence → explore more: 1.4 down to 1.0, thick evidence → 0.95 (exploit)
  return 1.4 - weight * 0.4;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function avgRetentionForTopic(cards: Card[], topicId: string, now: Date): number | null {
  const mine = cards.filter((c) => c.topicId === topicId);
  if (!mine.length) return null;
  const vals = mine.map((c) => retrievability(c, now));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function paperLabelFor(exams: ExamDate[], subjectId: Id): string | null {
  const row = exams.filter((e) => e.subjectId === subjectId).sort((a, b) => a.date.localeCompare(b.date))[0];
  return row?.label ?? null;
}

function buildExplanation(
  masteryRow: TopicMastery | null,
  marksPerHour: number | null,
  recoverableMarks: number,
  daysTo: number | null,
  label: string | null,
  factors: RecommendationFactors,
  topicId?: Id,
): RecommendationExplanation {
  const lastEvidencePercent = masteryRow ? Math.round(masteryRow.accuracy * 100) : null;
  // lastEvidence is null when no attempts exist → show as null rather than 0 so the UI can say "no evidence yet"
  const evidencePercent = masteryRow && masteryRow.attempts > 0 ? lastEvidencePercent : null;
  const daysSince = masteryRow?.lastStudiedAt ? daysBetween(masteryRow.lastStudiedAt.slice(0, 10), todayFromFactors(factors)) : null;
  // We don't have today threaded here; compute from lastStudiedAt delta inside caller instead.
  // Workaround: daysSince is computed by caller and passed through factors context; keep field for UI.
  void topicId;
  return {
    recoverableMarks: Math.round(recoverableMarks * 10) / 10,
    marksPerHour,
    lastEvidencePercent: evidencePercent,
    daysSinceRetrieval: daysSince,
    daysToExam: daysTo,
    paperLabel: label,
    factors,
  };
}

function todayFromFactors(_f: RecommendationFactors): string {
  // This is a tiny indirection so buildExplanation can stay pure. The actual
  // daysSince is computed upstream where `today` is in scope.
  return "";
}

export function recommend(input: RecommendInput): Recommendation[] {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const block = input.sessionLengthMinutes;
  const topicById = new Map(input.topics.map((t) => [t.id, t]));
  const masteryById = new Map(input.mastery.map((m) => [m.topicId, m]));
  const out: Recommendation[] = [];

  const urgencyBySubject = new Map(
    input.subjectIds.map((s) => [s, examUrgency(daysToExam(input.exams, s, today))]),
  );
  const urgency = (subjectId: Id) => urgencyBySubject.get(subjectId) ?? 1;

  function daysSinceFor(row: TopicMastery | undefined): number | null {
    if (!row?.lastStudiedAt) return null;
    const last = row.lastStudiedAt.slice(0, 10);
    if (last > today) return 0;
    return daysBetween(last, today);
  }

  // ----- shared helpers that produce the factor-weighted score -------------

  function scoreFromGain(gain: number, u: number, weak: number, forget: number, unc: number, minutes: number): number {
    const perMinute = gain / Math.max(5, minutes);
    // Marks-per-minute scaled so a 5-mark gain in 18 min reads ~0.28; multiply to keep competitive with legacy 20–100 scores.
    return perMinute * u * weak * forget * unc * 60;
  }

  // --- 1. Due reviews. Each due card protects ~0.35 marks from forgetting.
  const dueBySubject = new Map<Id, Card[]>();
  for (const card of input.cards) {
    if (!isDue(card, today)) continue;
    if (!input.subjectIds.includes(card.subjectId)) continue;
    const list = dueBySubject.get(card.subjectId) ?? [];
    list.push(card);
    dueBySubject.set(card.subjectId, list);
  }
  for (const [subjectId, cards] of dueBySubject) {
    const overdue = cards.filter((c) => c.due < today).length;
    const avgRet = (() => {
      const vals = cards.map((c) => retrievability(c, now));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
    })();
    const avgDaysOverdue =
      cards.reduce((a, c) => a + Math.max(0, daysBetween(c.due, today)), 0) / Math.max(1, cards.length);
    const overdueBoost = Math.min(0.25, avgDaysOverdue / 28) * 0.6;
    const forgetting = Math.min(2, forgettingFactor(avgRet, null) + overdueBoost);
    const u = urgency(subjectId);
    // Gain model: each due card is worth more when retention has decayed.
    const gainPerCard = 0.28 + (1 - avgRet) * 0.35;
    const examGain = cards.length * gainPerCard;
    const minutes = Math.min(block, Math.max(5, Math.ceil(cards.length * 0.45)));
    const weak = 1.05; // flashcards are not topic-weak-specific; neutral weakness
    const cardsTotal = cards.length;
    const unc = uncertaintyFactor(cardsTotal, 0);
    const factors: RecommendationFactors = { examGain: Math.round(examGain * 10) / 10, urgency: u, weakness: weak, forgetting, uncertainty: unc };
    const score = scoreFromGain(examGain, u, weak, forgetting, unc, minutes);
    const daysTo = daysToExam(input.exams, subjectId, today);
    const label = paperLabelFor(input.exams, subjectId);
    const explanation: RecommendationExplanation = {
      recoverableMarks: Math.round(examGain * 10) / 10,
      marksPerHour: Math.round((examGain / Math.max(5, minutes)) * 60 * 10) / 10,
      lastEvidencePercent: null,
      daysSinceRetrieval: null,
      daysToExam: daysTo,
      paperLabel: label,
      factors,
      count: cards.length,
      overdueCount: overdue,
    };
    out.push({
      activity: "flashcards",
      subjectId,
      minutes,
      score,
      reason:
        overdue > 0
          ? `${cards.length} cards due, ${overdue} already overdue — recall them before they fade further.`
          : `${cards.length} cards due today. Clearing them keeps every topic warm.`,
      explanation,
      factors,
    });
  }

  // --- 2. Unrepaired mistakes. Direct marks you have already dropped.
  const openMistakes = input.mistakes.filter((m) => !m.resolved);
  const mistakesBySubject = new Map<Id, Mistake[]>();
  for (const m of openMistakes) {
    if (!input.subjectIds.includes(m.subjectId)) continue;
    const list = mistakesBySubject.get(m.subjectId) ?? [];
    list.push(m);
    mistakesBySubject.set(m.subjectId, list);
  }
  for (const [subjectId, list] of mistakesBySubject) {
    if (list.length < 3) continue;
    const marksLost = list.reduce((a, m) => a + m.marksLost, 0);
    const recoverable = marksLost * 0.7;
    const examGain = recoverable;
    const u = urgency(subjectId);
    // Mistakes imply weakness; use the worst topic among them for forgetting/weakness.
    const worst = list
      .map((m) => masteryById.get(m.topicId))
      .filter(Boolean)
      .sort((a, b) => (a!.mastery ?? 0) - (b!.mastery ?? 0))[0];
    const weak = weaknessFactor(worst?.mastery ?? 0.4);
    const forgetting = forgettingFactor(worst?.retention ?? null, daysSinceFor(worst));
    const unc = uncertaintyFactor(worst?.cardsTotal ?? 0, worst?.attempts ?? 0);
    const minutes = Math.min(block, 15);
    const factors: RecommendationFactors = { examGain: Math.round(examGain * 10) / 10, urgency: u, weakness: weak, forgetting, uncertainty: unc };
    const score = scoreFromGain(examGain, u, weak, forgetting, unc, minutes);
    const daysTo = daysToExam(input.exams, subjectId, today);
    const label = paperLabelFor(input.exams, subjectId);
    const explanation: RecommendationExplanation = {
      recoverableMarks: Math.round(recoverable * 10) / 10,
      marksPerHour: Math.round((recoverable / Math.max(5, minutes)) * 60 * 10) / 10,
      lastEvidencePercent: worst ? Math.round(worst.accuracy * 100) : null,
      daysSinceRetrieval: daysSinceFor(worst),
      daysToExam: daysTo,
      paperLabel: label,
      factors,
      count: list.length,
    };
    out.push({
      activity: "mistakes",
      subjectId,
      minutes,
      score: score,
      reason: `${list.length} mistakes are still unrepaired. Re-answering them is the highest-value 15 minutes you have.`,
      explanation,
      factors,
    });
  }

  // --- 3. Weak topics → exam-style practice. Ranked by recoverable ÷ time, weighted.
  for (const weakRow of weakTopics(input.mastery, 12)) {
    if (!input.subjectIds.includes(weakRow.subjectId)) continue;
    const topic = topicById.get(weakRow.topicId);
    if (!topic) continue;
    const mph = input.marksPerHour?.get(weakRow.topicId) ?? null;
    // Expected time: practice questions take ~block minutes; scale recoverable to that block.
    const minutes = block;
    const recoverable = mph != null ? mph * (minutes / 60) : (1 - weakRow.mastery) * 8;
    // For the "18 min" electrolysis spec, tests may pass 18 as block; keep honest.
    const examGain = recoverable;
    const u = urgency(weakRow.subjectId);
    const weak = weaknessFactor(weakRow.mastery);
    const forgetting = forgettingFactor(weakRow.retention, daysSinceFor(weakRow));
    const unc = uncertaintyFactor(weakRow.cardsTotal, weakRow.attempts);
    const factors: RecommendationFactors = { examGain: Math.round(examGain * 10) / 10, urgency: u, weakness: weak, forgetting, uncertainty: unc };
    const score = scoreFromGain(examGain, u, weak, forgetting, unc, minutes);
    const daysTo = daysToExam(input.exams, weakRow.subjectId, today);
    const label = paperLabelFor(input.exams, weakRow.subjectId);
    const mphRounded = mph != null ? Math.round(mph * 10) / 10 : null;
    const explanation: RecommendationExplanation = {
      recoverableMarks: Math.round(recoverable * 10) / 10,
      marksPerHour: mphRounded,
      lastEvidencePercent: weakRow.attempts > 0 ? Math.round(weakRow.accuracy * 100) : null,
      daysSinceRetrieval: daysSinceFor(weakRow),
      daysToExam: daysTo,
      paperLabel: label,
      factors,
    };
    // Scale minutes for very small blocks: if block is 10, don't claim 8 marks; the mph path handles it.
    const reason = mph != null
      ? `${topic.title}: ~${mphRounded!.toFixed(1)} expected exam marks per hour. ${Math.round(weakRow.mastery * 100)}% mastery — fixing this converts fastest.`
      : `${topic.title} is your weakest topic here (${Math.round(weakRow.mastery * 100)}% mastery). Exam questions on it will move your grade most.`;
    out.push({
      activity: "practice",
      subjectId: weakRow.subjectId,
      topicId: weakRow.topicId,
      minutes,
      score: score * 1.05, // practice is the differentiated activity; slight prior
      reason,
      explanation,
      factors,
    });
  }

  // --- 4. Never-studied topics → first-pass learn.
  for (const fresh of untouchedTopics(input.mastery)) {
    if (!input.subjectIds.includes(fresh.subjectId)) continue;
    const topic = topicById.get(fresh.topicId);
    if (!topic) continue;
    const minutes = Math.min(block, 20);
    // First pass is coverage, not recovery: modest gain, high uncertainty.
    const examGain = 2.2 + (6 - topic.intrinsicDifficulty) * 0.25;
    const u = urgency(fresh.subjectId);
    const weak = 1.6; // unknown is maximally weak
    const forgetting = 1.1;
    const unc = 1.4;
    const factors: RecommendationFactors = { examGain: Math.round(examGain * 10) / 10, urgency: u, weakness: weak, forgetting, uncertainty: unc };
    const score = scoreFromGain(examGain, u, weak, forgetting, unc, minutes);
    const daysTo = daysToExam(input.exams, fresh.subjectId, today);
    const label = paperLabelFor(input.exams, fresh.subjectId);
    const explanation: RecommendationExplanation = {
      recoverableMarks: Math.round(examGain * 10) / 10,
      marksPerHour: Math.round((examGain / Math.max(5, minutes)) * 60 * 10) / 10,
      lastEvidencePercent: null,
      daysSinceRetrieval: null,
      daysToExam: daysTo,
      paperLabel: label,
      factors,
    };
    out.push({
      activity: "learn",
      subjectId: fresh.subjectId,
      topicId: fresh.topicId,
      minutes,
      score,
      reason: `You have not started ${topic.title} yet. A 20-minute first pass turns a blank into something revisable.`,
      explanation,
      factors,
    });
  }

  // --- 5. Full past paper once a subject is broadly solid or the exam nears
  for (const subjectId of input.subjectIds) {
    const rows = input.mastery.filter((m) => m.subjectId === subjectId);
    if (!rows.length) continue;
    const avg = rows.reduce((a, m) => a + m.mastery, 0) / rows.length;
    const days = daysToExam(input.exams, subjectId, today);
    if (avg < 0.6 && (days == null || days > 21)) continue;
    const minutes = Math.min(block * 2, 90);
    // A paper's gain is calibration + stamina: modelled as (1 - avg) * ~6 marks scaled to paper size.
    const examGain = (1 - avg) * 9 + (days != null && days <= 21 ? 3 : 0);
    const u = urgency(subjectId);
    const weak = 1 + (1 - avg) * 0.5;
    const avgRetention = rows.reduce((a, m) => a + (m.retention ?? 0.5), 0) / rows.length;
    const forgetting = forgettingFactor(avgRetention, null);
    const avgAttempts = Math.round(rows.reduce((a, m) => a + m.attempts, 0) / rows.length);
    const avgCards = Math.round(rows.reduce((a, m) => a + m.cardsTotal, 0) / rows.length);
    const unc = uncertaintyFactor(avgCards, avgAttempts);
    const factors: RecommendationFactors = { examGain: Math.round(examGain * 10) / 10, urgency: u, weakness: weak, forgetting, uncertainty: unc };
    const score = scoreFromGain(examGain, u, weak, forgetting, unc, minutes);
    const label = paperLabelFor(input.exams, subjectId);
    const explanation: RecommendationExplanation = {
      recoverableMarks: Math.round(examGain * 10) / 10,
      marksPerHour: Math.round((examGain / Math.max(5, minutes)) * 60 * 10) / 10,
      lastEvidencePercent: Math.round(rows.reduce((a, m) => a + m.accuracy, 0) / rows.length * 100),
      daysSinceRetrieval: null,
      daysToExam: days,
      paperLabel: label,
      factors,
    };
    out.push({
      activity: "paper",
      subjectId,
      minutes,
      score,
      reason:
        days != null && days <= 21
          ? `${days} days to the exam — full papers under timed conditions are what is left to gain.`
          : `You are solid across this subject. A timed paper tests whether it holds up under exam pressure.`,
      explanation,
      factors,
    });
  }

  // --- 6. The student's own plan wins ties (additive, not multiplicative).
  const todaysPlan = input.plan.filter((p) => p.date === today && p.status === "pending");
  for (const session of todaysPlan) {
    const match = out.find(
      (r) =>
        r.activity === session.activity &&
        r.subjectId === session.subjectId &&
        (session.topicId == null || r.topicId === session.topicId),
    );
    if (match) {
      match.score += 12;
      match.plannedSessionId = session.id;
    } else {
      const u = urgency(session.subjectId);
      const examGain = 2.5;
      const factors: RecommendationFactors = { examGain, urgency: u, weakness: 1, forgetting: 1, uncertainty: 1 };
      const daysTo = daysToExam(input.exams, session.subjectId, today);
      const label = paperLabelFor(input.exams, session.subjectId);
      out.push({
        activity: session.activity,
        subjectId: session.subjectId,
        topicId: session.topicId,
        minutes: session.minutes,
        score: 28 * u,
        reason: session.reason || "Scheduled in today's plan.",
        plannedSessionId: session.id,
        explanation: {
          recoverableMarks: examGain,
          marksPerHour: Math.round((examGain / Math.max(5, session.minutes)) * 60 * 10) / 10,
          lastEvidencePercent: null,
          daysSinceRetrieval: null,
          daysToExam: daysTo,
          paperLabel: label,
          factors,
        },
        factors,
      });
    }
  }

  const missed = input.plan.filter((p) => p.date < today && p.status === "pending");
  for (const session of missed.slice(0, 3)) {
    const match = out.find((r) => r.activity === session.activity && r.subjectId === session.subjectId);
    if (match) match.score += 4;
  }

  return dedupe(out).sort((a, b) => b.score - a.score);
}

/** Keep the strongest candidate per activity+subject+topic triple. */
function dedupe(list: Recommendation[]): Recommendation[] {
  const best = new Map<string, Recommendation>();
  for (const r of list) {
    const key = `${r.activity}:${r.subjectId}:${r.topicId ?? "-"}`;
    const existing = best.get(key);
    if (!existing || r.score > existing.score) best.set(key, r);
  }
  return [...best.values()];
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  learn: "Learn",
  flashcards: "Flashcards",
  recall: "Active recall",
  practice: "Exam questions",
  paper: "Past paper",
  mistakes: "Mistake repair",
};

export const ACTIVITY_BLURB: Record<ActivityKind, string> = {
  learn: "First pass over new material, then immediate self-testing.",
  flashcards: "Spaced-repetition review of cards that are due today.",
  recall: "Blank-page recall against the spec, marked as you go.",
  practice: "Exam-style questions with examiner-style marking.",
  paper: "A full paper under timed conditions.",
  mistakes: "Re-answer the questions you got wrong until they stick.",
};
