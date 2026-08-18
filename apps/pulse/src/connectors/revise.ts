/**
 * Revise connector.
 *
 * Maps Revise's three record kinds onto the universal schema. The key
 * modelling decision: a flashcard review and a question attempt both produce
 * an *accuracy* metric on 0..1, so "how accurate was I" is answerable across
 * study modes, while `method` stays as an attribute so the analysis can still
 * split by it.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import { migrateSourceHistory } from "../events/source-history.js";

export type ReviseGrade = "again" | "hard" | "good" | "easy";

export interface ReviseReviewRecord {
  kind: "review";
  id: string;
  cardId: string;
  topicId: string;
  subjectId: string;
  grade: ReviseGrade;
  confidence?: 1 | 2 | 3 | 4 | 5;
  elapsedMs: number;
  reviewedAt: string;
  /** Days since the card was last seen — the retention signal. */
  intervalDays?: number;
  timezone?: string;
}

export interface ReviseAttemptRecord {
  kind: "attempt";
  id: string;
  questionId: string;
  subjectId: string;
  topicIds: string[];
  awarded: number;
  max: number;
  confidence?: 1 | 2 | 3 | 4 | 5;
  elapsedMs: number;
  mode: "practice" | "paper" | "recall";
  markedBy: "ai" | "rubric" | "self";
  createdAt: string;
  timezone?: string;
}

export interface ReviseSessionRecord {
  kind: "session";
  id: string;
  subjectId: string;
  topicIds: string[];
  activityKind: "learn" | "flashcards" | "recall" | "practice" | "paper" | "mistakes";
  startedAt: string;
  endedAt: string;
  itemsCompleted: number;
  itemsCorrect: number;
  timezone?: string;
}

export type ReviseRecord = ReviseReviewRecord | ReviseAttemptRecord | ReviseSessionRecord;

export const DEFAULT_REVISE_HISTORY_ENDPOINT = "/revise/api/pulse/history";

/** Grades map onto 0..1 so accuracy is comparable with question marks. */
const GRADE_ACCURACY: Record<ReviseGrade, number> = { again: 0, hard: 0.34, good: 0.67, easy: 1 };
const GRADE_ORDINAL: Record<ReviseGrade, number> = { again: 0, hard: 1, good: 2, easy: 3 };

const SCOPES: ConnectorScope[] = [
  { id: "reviews", description: "Flashcard reviews: which card, how you graded it, and how long it took", readsContent: false },
  { id: "attempts", description: "Exam-question attempts: marks awarded and time taken", readsContent: false },
  { id: "sessions", description: "Study session start and end times", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "revise.review",
    category: "study",
    description: "A single flashcard review",
    metrics: [
      { key: "accuracy", unit: "ratio", description: "Recall accuracy, 0..1", range: { min: 0, max: 1 } },
      { key: "recall_grade", unit: "score", description: "Ordinal grade (0 again .. 3 easy)", range: { min: 0, max: 3 } },
      { key: "response_ms", unit: "ms", description: "Time to answer", range: { min: 0, max: 3_600_000 } },
      { key: "confidence", unit: "score", description: "Self-rated confidence before reveal", range: { min: 1, max: 5 } },
      { key: "interval_days", unit: "count", description: "Days since the card was last seen", range: { min: 0, max: 3650 } },
    ],
  },
  {
    type: "revise.attempt",
    category: "study",
    description: "An exam-style question attempt",
    metrics: [
      { key: "accuracy", unit: "ratio", description: "Marks awarded / marks available", range: { min: 0, max: 1 } },
      { key: "marks_awarded", unit: "count", description: "Marks awarded", range: { min: 0, max: 200 } },
      { key: "marks_available", unit: "count", description: "Marks available", range: { min: 0, max: 200 } },
      { key: "response_ms", unit: "ms", description: "Time to answer", range: { min: 0, max: 14_400_000 } },
      { key: "confidence", unit: "score", description: "Self-rated confidence", range: { min: 1, max: 5 } },
      { key: "calibration_error", unit: "ratio", description: "|confidence/5 - accuracy|", range: { min: 0, max: 1 } },
    ],
  },
  {
    type: "revise.session",
    category: "study",
    description: "A completed study session",
    metrics: [
      { key: "duration_minutes", unit: "minutes", description: "Session length", range: { min: 0, max: 720 } },
      { key: "items_completed", unit: "count", description: "Cards or questions completed", range: { min: 0, max: 10_000 } },
      { key: "accuracy", unit: "ratio", description: "Correct / completed", range: { min: 0, max: 1 } },
      { key: "throughput_per_minute", unit: "ratio", description: "Items per minute", range: { min: 0, max: 200 } },
    ],
  },
];

export function mapReviseRecord(record: ReviseRecord): RawEventInput[] {
  switch (record.kind) {
    case "review": {
      const accuracy = GRADE_ACCURACY[record.grade];
      const metrics: Record<string, number> = {
        accuracy,
        recall_grade: GRADE_ORDINAL[record.grade],
        response_ms: Math.max(0, record.elapsedMs),
      };
      if (record.confidence !== undefined) metrics.confidence = record.confidence;
      if (record.intervalDays !== undefined) metrics.interval_days = Math.max(0, record.intervalDays);

      return [
        {
          source: "revise",
          sourceEventId: record.id,
          type: "revise.review",
          category: "study",
          occurredAt: record.reviewedAt,
          ...(record.timezone ? { timezone: record.timezone } : {}),
          durationMs: Math.max(0, record.elapsedMs),
          subject: record.topicId,
          metrics,
          attributes: {
            method: "flashcards",
            subject_id: record.subjectId,
            topic_id: record.topicId,
            card_id: record.cardId,
            grade: record.grade,
            correct: accuracy >= 0.67,
          },
        },
      ];
    }

    case "attempt": {
      if (record.max <= 0) return []; // A question worth no marks carries no accuracy signal.
      const accuracy = Math.min(1, Math.max(0, record.awarded / record.max));
      const metrics: Record<string, number> = {
        accuracy,
        marks_awarded: record.awarded,
        marks_available: record.max,
        response_ms: Math.max(0, record.elapsedMs),
      };
      if (record.confidence !== undefined) {
        metrics.confidence = record.confidence;
        // Over-confidence is itself a studyable behaviour, so derive it here
        // rather than leaving every analysis to recompute it.
        metrics.calibration_error = Math.abs(record.confidence / 5 - accuracy);
      }

      return [
        {
          source: "revise",
          sourceEventId: record.id,
          type: "revise.attempt",
          category: "study",
          occurredAt: record.createdAt,
          ...(record.timezone ? { timezone: record.timezone } : {}),
          durationMs: Math.max(0, record.elapsedMs),
          subject: record.topicIds[0] ?? record.subjectId,
          metrics,
          attributes: {
            method: record.mode,
            subject_id: record.subjectId,
            topic_count: record.topicIds.length,
            marked_by: record.markedBy,
            question_id: record.questionId,
          },
        },
      ];
    }

    case "session": {
      const start = Date.parse(record.startedAt);
      const end = Date.parse(record.endedAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
      const durationMs = end - start;
      const durationMinutes = durationMs / 60_000;
      const metrics: Record<string, number> = {
        duration_minutes: durationMinutes,
        items_completed: record.itemsCompleted,
        throughput_per_minute: durationMinutes > 0 ? record.itemsCompleted / durationMinutes : 0,
      };
      if (record.itemsCompleted > 0) metrics.accuracy = record.itemsCorrect / record.itemsCompleted;

      return [
        {
          source: "revise",
          sourceEventId: record.id,
          type: "revise.session",
          category: "study",
          occurredAt: record.startedAt,
          ...(record.timezone ? { timezone: record.timezone } : {}),
          durationMs,
          subject: record.topicIds[0] ?? record.subjectId,
          metrics,
          attributes: {
            method: record.activityKind,
            subject_id: record.subjectId,
            topic_count: record.topicIds.length,
          },
        },
      ];
    }
  }
}

export function createReviseConnector(reader: SourceReader<ReviseRecord>): Connector {
  return defineReaderConnector<ReviseRecord>({
    id: "revise",
    name: "Revise",
    version: "2.0.0",
    category: "study",
    description: "Spaced-repetition reviews, exam-question attempts and study sessions.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1825,
    reader,
    map: (record) => mapReviseRecord(record),
    timestampOf: (record) =>
      record.kind === "review" ? record.reviewedAt : record.kind === "attempt" ? record.createdAt : record.startedAt,
  });
}

export interface ReviseCloudConnectorOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

/**
 * Reader for Revise's authenticated cloud replica. The endpoint returns the
 * same versioned envelope used by local sibling histories, so Pulse can
 * migrate connector payloads before mapping them and can fail closed on a
 * future schema.
 */
export function createReviseCloudConnector(options: ReviseCloudConnectorOptions = {}): Connector {
  const endpoint = options.endpoint ?? DEFAULT_REVISE_HISTORY_ENDPOINT;
  const fetcher = options.fetcher ?? globalThis.fetch;
  const reader: SourceReader<ReviseRecord> = {
    async read(since, limit) {
      if (typeof fetcher !== "function") throw new Error("Fetch is unavailable in this environment");
      const url = new URL(endpoint, globalThis.location?.origin ?? "http://localhost");
      if (since) url.searchParams.set("since", since);
      url.searchParams.set("limit", String(limit));
      const response = await fetcher(url.toString(), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Revise history returned HTTP ${response.status}`);
      const payload = (await response.json()) as unknown;
      const envelope = migrateSourceHistory(payload, "revise");
      return {
        records: envelope.records as ReviseRecord[],
        hasMore: Boolean((payload as { hasMore?: unknown })?.hasMore),
      };
    },
    async probe() {
      try {
        const result = await this.read(null, 1);
        const last = result.records[result.records.length - 1];
        return {
          ok: true,
          message: "Authenticated Revise history is available",
          latestAt: last
            ? new Date(
                Date.parse(last.kind === "review" ? last.reviewedAt : last.kind === "attempt" ? last.createdAt : last.startedAt),
              ).toISOString()
            : null,
        };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error), latestAt: null };
      }
    },
  };
  return createReviseConnector(reader);
}
