/**
 * Le Studio French connector.
 *
 * Emits speaking practice and review sessions separately, because the
 * question Pulse is asked about this source — "does speaking practice improve
 * later recall?" — is precisely a lagged relationship *between* those two
 * event types. Collapsing them into one "French session" event would make that
 * question unanswerable.
 */

import { defineReaderConnector } from "./sdk.js";
import { createSameOriginReader, type StorageLike } from "./same-origin.js";
import { readSourceHistoryRecords } from "../events/source-history.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface FrenchSpeakingRecord {
  kind: "speaking";
  id: string;
  startedAt: string;
  durationMs: number;
  /** Automatic scoring from the speech pipeline, 0..1. */
  pronunciationScore?: number;
  fluencyScore?: number;
  wordsSpoken?: number;
  promptCount: number;
  topic?: string;
  timezone?: string;
}

export interface FrenchReviewRecord {
  kind: "review";
  id: string;
  reviewedAt: string;
  itemId: string;
  skill: "vocab" | "grammar" | "listening" | "reading";
  correct: boolean;
  elapsedMs: number;
  intervalDays?: number;
  timezone?: string;
}

export type FrenchRecord = FrenchSpeakingRecord | FrenchReviewRecord;

export const FRENCH_STORAGE_KEY = "fp.pulse-history.v2";

const SCOPES: ConnectorScope[] = [
  { id: "speaking", description: "Speaking practice sessions: duration, prompts and automatic pronunciation scores. Audio is never read.", readsContent: false },
  { id: "reviews", description: "Vocabulary and grammar reviews: correct/incorrect and timing", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "french.speaking",
    category: "language",
    description: "A speaking practice session",
    metrics: [
      { key: "duration_minutes", unit: "minutes", description: "Session length", range: { min: 0, max: 300 } },
      { key: "pronunciation_score", unit: "ratio", description: "Automatic pronunciation score", range: { min: 0, max: 1 } },
      { key: "fluency_score", unit: "ratio", description: "Automatic fluency score", range: { min: 0, max: 1 } },
      { key: "words_spoken", unit: "count", description: "Words produced", range: { min: 0, max: 20_000 } },
      { key: "prompt_count", unit: "count", description: "Prompts attempted", range: { min: 0, max: 500 } },
    ],
  },
  {
    type: "french.review",
    category: "language",
    description: "A single vocabulary or grammar review",
    metrics: [
      { key: "accuracy", unit: "ratio", description: "1 when recalled correctly", range: { min: 0, max: 1 } },
      { key: "response_ms", unit: "ms", description: "Time to answer", range: { min: 0, max: 600_000 } },
      { key: "interval_days", unit: "count", description: "Days since last seen", range: { min: 0, max: 3650 } },
    ],
  },
];

export function mapFrenchRecord(record: FrenchRecord): RawEventInput[] {
  if (record.kind === "speaking") {
    const metrics: Record<string, number> = {
      duration_minutes: Math.max(0, record.durationMs) / 60_000,
      prompt_count: record.promptCount,
    };
    if (typeof record.pronunciationScore === "number") metrics.pronunciation_score = record.pronunciationScore;
    if (typeof record.fluencyScore === "number") metrics.fluency_score = record.fluencyScore;
    if (typeof record.wordsSpoken === "number") metrics.words_spoken = record.wordsSpoken;

    return [
      {
        source: "le-studio-french",
        sourceEventId: record.id,
        type: "french.speaking",
        category: "language",
        occurredAt: record.startedAt,
        ...(record.timezone ? { timezone: record.timezone } : {}),
        durationMs: Math.max(0, record.durationMs),
        subject: record.topic ?? "speaking",
        metrics,
        attributes: { skill: "speaking", ...(record.topic ? { topic: record.topic } : {}) },
      },
    ];
  }

  const metrics: Record<string, number> = {
    accuracy: record.correct ? 1 : 0,
    response_ms: Math.max(0, record.elapsedMs),
  };
  if (typeof record.intervalDays === "number") metrics.interval_days = Math.max(0, record.intervalDays);

  return [
    {
      source: "le-studio-french",
      sourceEventId: record.id,
      type: "french.review",
      category: "language",
      occurredAt: record.reviewedAt,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      durationMs: Math.max(0, record.elapsedMs),
      subject: record.skill,
      metrics,
      attributes: { skill: record.skill, item_id: record.itemId, correct: record.correct },
    },
  ];
}

export function createFrenchConnector(reader: SourceReader<FrenchRecord>): Connector {
  return defineReaderConnector<FrenchRecord>({
    id: "le-studio-french",
    name: "Le Studio French",
    version: "2.0.0",
    category: "language",
    description: "French speaking practice and spaced review. Audio recordings are never read.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1825,
    reader,
    map: (record) => mapFrenchRecord(record),
    timestampOf: (record) => (record.kind === "speaking" ? record.startedAt : record.reviewedAt),
  });
}

export function selectFrenchRecords(state: unknown): FrenchRecord[] {
  return readSourceHistoryRecords<FrenchRecord>(state, "le-studio-french").filter(
    (record): record is FrenchRecord =>
      (record.kind === "speaking" && typeof record.id === "string" && typeof record.startedAt === "string") ||
      (record.kind === "review" && typeof record.id === "string" && typeof record.reviewedAt === "string"),
  );
}

export function createFrenchSameOriginConnector(options: { storage?: StorageLike | null } = {}): Connector {
  return createFrenchConnector(
    createSameOriginReader<FrenchRecord>({
      key: FRENCH_STORAGE_KEY,
      label: "Le Studio French",
      select: selectFrenchRecords,
      ...(options.storage !== undefined ? { storage: options.storage } : {}),
      timestampOf: (record) => (record.kind === "speaking" ? record.startedAt : record.reviewedAt),
    }),
  );
}
