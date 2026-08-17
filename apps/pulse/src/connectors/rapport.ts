/**
 * Rapport connector — social-skills training.
 *
 * Emits simulator drills and real-world challenges as distinct types: a drill
 * is practice under controlled conditions, a challenge is performance in the
 * wild, and treating them as the same event would let easy practice inflate
 * apparent progress.
 */

import { defineReaderConnector } from "./sdk.js";
import { createSameOriginReader, type StorageLike } from "./same-origin.js";
import { readSourceHistoryRecords } from "../events/source-history.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface RapportDrillRecord {
  kind: "drill";
  id: string;
  startedAt: string;
  durationMs: number;
  skillId: string;
  /** 0..1 score from the simulator's rubric. */
  score: number;
  turnCount?: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  timezone?: string;
}

export interface RapportChallengeRecord {
  kind: "challenge";
  id: string;
  completedAt: string;
  skillId: string;
  completed: boolean;
  /** 1..5 self-rated comfort during the challenge. */
  comfort?: number;
  timezone?: string;
}

export type RapportRecord = RapportDrillRecord | RapportChallengeRecord;

export const RAPPORT_STORAGE_KEY = "rapport.pulse-history.v2";

const SCOPES: ConnectorScope[] = [
  { id: "drills", description: "Conversation simulator drills: skill, score and duration. Transcripts are never read.", readsContent: false },
  { id: "challenges", description: "Real-world challenges: whether you completed them and how comfortable you felt", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "rapport.drill",
    category: "social",
    description: "A conversation simulator drill",
    metrics: [
      { key: "score", unit: "ratio", description: "Rubric score", range: { min: 0, max: 1 } },
      { key: "duration_minutes", unit: "minutes", description: "Drill length", range: { min: 0, max: 240 } },
      { key: "turn_count", unit: "count", description: "Conversational turns", range: { min: 0, max: 1000 } },
      { key: "difficulty", unit: "level", description: "Selected difficulty", range: { min: 1, max: 5 } },
    ],
  },
  {
    type: "rapport.challenge",
    category: "social",
    description: "A real-world social challenge",
    metrics: [
      { key: "completed", unit: "ratio", description: "1 when the challenge was completed", range: { min: 0, max: 1 } },
      { key: "comfort", unit: "score", description: "Self-rated comfort", range: { min: 1, max: 5 } },
    ],
  },
];

export function mapRapportRecord(record: RapportRecord): RawEventInput[] {
  if (record.kind === "drill") {
    const metrics: Record<string, number> = {
      score: record.score,
      duration_minutes: Math.max(0, record.durationMs) / 60_000,
    };
    if (typeof record.turnCount === "number") metrics.turn_count = record.turnCount;
    if (typeof record.difficulty === "number") metrics.difficulty = record.difficulty;

    return [
      {
        source: "rapport",
        sourceEventId: record.id,
        type: "rapport.drill",
        category: "social",
        occurredAt: record.startedAt,
        ...(record.timezone ? { timezone: record.timezone } : {}),
        durationMs: Math.max(0, record.durationMs),
        subject: record.skillId,
        metrics,
        attributes: { skill_id: record.skillId, setting: "simulator" },
      },
    ];
  }

  const metrics: Record<string, number> = { completed: record.completed ? 1 : 0 };
  if (typeof record.comfort === "number") metrics.comfort = record.comfort;

  return [
    {
      source: "rapport",
      sourceEventId: record.id,
      type: "rapport.challenge",
      category: "social",
      occurredAt: record.completedAt,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: record.skillId,
      metrics,
      attributes: { skill_id: record.skillId, setting: "real-world" },
    },
  ];
}

export function createRapportConnector(reader: SourceReader<RapportRecord>): Connector {
  return defineReaderConnector<RapportRecord>({
    id: "rapport",
    name: "Rapport",
    version: "2.0.0",
    category: "social",
    description: "Social-skills drills and real-world challenges. Conversation transcripts are never read.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1095,
    reader,
    map: (record) => mapRapportRecord(record),
    timestampOf: (record) => (record.kind === "drill" ? record.startedAt : record.completedAt),
  });
}

/** Read Rapport's durable, transcript-free event history from the shared origin. */
export function selectRapportRecords(state: unknown): RapportRecord[] {
  return readSourceHistoryRecords<RapportRecord>(state, "rapport").filter(
    (record): record is RapportRecord =>
      (record.kind === "drill" && typeof record.id === "string" && typeof record.startedAt === "string") ||
      (record.kind === "challenge" && typeof record.id === "string" && typeof record.completedAt === "string"),
  );
}

export function createRapportSameOriginConnector(options: { storage?: StorageLike | null } = {}): Connector {
  return createRapportConnector(
    createSameOriginReader<RapportRecord>({
      key: RAPPORT_STORAGE_KEY,
      label: "Rapport",
      select: selectRapportRecords,
      ...(options.storage !== undefined ? { storage: options.storage } : {}),
      timestampOf: (record) => (record.kind === "drill" ? record.startedAt : record.completedAt),
    }),
  );
}
