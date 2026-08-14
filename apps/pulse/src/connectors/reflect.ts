/**
 * Reflect connector — structured reflection and mood.
 *
 * The most sensitive source Pulse touches, and the only one that requires its
 * own explicit permission. Three protections are built into the connector
 * itself rather than left to policy:
 *
 *  1. `requiresExplicitPermission` — bulk "connect everything" cannot enable it.
 *  2. Every event is marked `sensitive`, so it is excluded from queries,
 *     exports to AI and telemetry unless the caller opts in deliberately.
 *  3. Entry text never leaves the source. Only ratings and a word count are
 *     mapped; the `content` scope exists so the consent dialog can be honest
 *     that even the word count is derived from what was written.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface ReflectEntryRecord {
  kind: "entry";
  id: string;
  writtenAt: string;
  /** 1..10 self-ratings. */
  mood?: number;
  energy?: number;
  stress?: number;
  clarity?: number;
  /** Word count only — the connector never receives or forwards the text. */
  wordCount?: number;
  /** Whether the structured follow-up action was completed. */
  followUpCompleted?: boolean;
  tag?: string;
  timezone?: string;
}

export type ReflectRecord = ReflectEntryRecord;

const SCOPES: ConnectorScope[] = [
  {
    id: "ratings",
    description: "Your mood, energy, stress and clarity ratings. Numbers only.",
    readsContent: false,
  },
  {
    id: "entry-shape",
    description: "How long each reflection was and whether you completed the follow-up. The text itself is never read or stored by Pulse.",
    readsContent: true,
  },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "reflect.entry",
    category: "reflection",
    description: "A structured reflection entry",
    metrics: [
      { key: "mood", unit: "score", description: "Self-rated mood", range: { min: 0, max: 10 } },
      { key: "energy", unit: "score", description: "Self-rated energy", range: { min: 0, max: 10 } },
      { key: "stress", unit: "score", description: "Self-rated stress", range: { min: 0, max: 10 } },
      { key: "clarity", unit: "score", description: "Self-rated clarity", range: { min: 0, max: 10 } },
      { key: "word_count", unit: "count", description: "Length of the entry in words", range: { min: 0, max: 20_000 } },
      { key: "follow_up_completed", unit: "ratio", description: "1 when the follow-up action was done", range: { min: 0, max: 1 } },
    ],
  },
];

export function mapReflectRecord(record: ReflectRecord): RawEventInput[] {
  const metrics: Record<string, number> = {};
  if (typeof record.mood === "number") metrics.mood = record.mood;
  if (typeof record.energy === "number") metrics.energy = record.energy;
  if (typeof record.stress === "number") metrics.stress = record.stress;
  if (typeof record.clarity === "number") metrics.clarity = record.clarity;
  if (typeof record.wordCount === "number") metrics.word_count = record.wordCount;
  if (record.followUpCompleted !== undefined) metrics.follow_up_completed = record.followUpCompleted ? 1 : 0;
  if (Object.keys(metrics).length === 0) return [];

  return [
    {
      source: "reflect",
      sourceEventId: record.id,
      type: "reflect.entry",
      category: "reflection",
      occurredAt: record.writtenAt,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: "reflection",
      metrics,
      // Explicit rather than inherited: a future refactor of the default must
      // not be able to silently declassify this source.
      sensitivity: "sensitive",
      attributes: { ...(record.tag ? { tag: record.tag } : {}) },
    },
  ];
}

export function createReflectConnector(reader: SourceReader<ReflectRecord>): Connector {
  return defineReaderConnector<ReflectRecord>({
    id: "reflect",
    name: "Reflect",
    version: "1.0.0",
    category: "reflection",
    description: "Mood, energy and reflection ratings. Requires its own explicit permission; entry text never leaves Reflect.",
    scopes: SCOPES,
    emits: EMITS,
    requiresExplicitPermission: true,
    defaultSensitivity: "sensitive",
    maxBackfillDays: 1825,
    reader,
    map: (record) => mapReflectRecord(record),
    timestampOf: (record) => record.writtenAt,
  });
}
