import type { DomainEvent } from "@/domain/events";
import type { Simulation } from "@/domain/types";

export const RAPPORT_PULSE_HISTORY_KEY = "rapport.pulse-history.v2";
export const RAPPORT_PULSE_HISTORY_FORMAT = "le-studio.source-history";
export const RAPPORT_PULSE_HISTORY_VERSION = 2;

/**
 * Rapport's own Pulse opt-in, kept apart from the mirror it gates. Off by
 * default; only the explicit on-value is accepted. Revoking it deletes the
 * mirror outright so the flow stops at the source.
 */
export const RAPPORT_PULSE_OPT_IN_KEY = "rapport-pulse-opt-in";

export function rapportPulseOptInGranted(flag: unknown): boolean {
  return flag === "1" || flag === 1;
}

export type RapportPulseRecord =
  | {
      kind: "drill";
      id: string;
      startedAt: string;
      durationMs: number;
      skillId: string;
      score: number;
      turnCount?: number;
      difficulty?: 1 | 2 | 3 | 4 | 5;
    }
  | {
      kind: "challenge";
      id: string;
      completedAt: string;
      skillId: string;
      completed: boolean;
      comfort?: number;
    };

interface RapportPulseEnvelope {
  format: typeof RAPPORT_PULSE_HISTORY_FORMAT;
  schemaVersion: typeof RAPPORT_PULSE_HISTORY_VERSION;
  source: "rapport";
  connectorVersion: "2.0.0";
  generatedAt: string;
  records: RapportPulseRecord[];
  cursor: null;
}

function asDifficulty(value: number | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
  return value === undefined || value < 1 || value > 5 ? undefined : (Math.round(value) as 1 | 2 | 3 | 4 | 5);
}

/** Project Rapport's private event log into the safe, transcript-free Pulse view. */
export function buildRapportPulseHistory(
  events: readonly DomainEvent[],
  simulations: readonly Simulation[] = [],
  generatedAt = new Date().toISOString(),
): RapportPulseEnvelope {
  const simulationById = new Map(simulations.map((simulation) => [simulation.id, simulation]));
  const records: RapportPulseRecord[] = [];

  for (const event of events) {
    if (event.kind === "simulation-evaluated") {
      const simulation = simulationById.get(event.simulationId);
      const start = simulation?.startedAt ?? event.at;
      const end = simulation?.endedAt ? Date.parse(simulation.endedAt) : Date.parse(event.at);
      const startMs = Date.parse(start);
      const durationMs = Number.isFinite(startMs) && Number.isFinite(end) ? Math.max(0, end - startMs) : 0;
      records.push({
        kind: "drill",
        id: `evaluation:${event.simulationId}`,
        startedAt: start,
        durationMs,
        skillId: event.skillIds[0] ?? "unknown",
        score: Math.max(0, Math.min(1, event.performance)),
        ...(simulation?.turns.length !== undefined ? { turnCount: simulation.turns.length } : {}),
        ...(asDifficulty(simulation?.deliveredDifficulty ?? event.difficulty)
          ? { difficulty: asDifficulty(simulation?.deliveredDifficulty ?? event.difficulty) }
          : {}),
      });
    }

    if (event.kind === "challenge-attempted") {
      records.push({
        kind: "challenge",
        id: event.attemptId,
        completedAt: event.at,
        skillId: event.skillId,
        completed: event.outcome !== "no",
        ...(event.comfort === undefined ? {} : { comfort: event.comfort }),
      });
    }
  }

  return {
    format: RAPPORT_PULSE_HISTORY_FORMAT,
    schemaVersion: RAPPORT_PULSE_HISTORY_VERSION,
    source: "rapport",
    connectorVersion: "2.0.0",
    generatedAt,
    records,
    cursor: null,
  };
}

/** Read the app's own opt-in flag (undefined storage means "not granted"). */
export function readRapportPulseOptIn(storage: StorageLike = defaultStorage()): boolean {
  return rapportPulseOptInGranted(parseFlag(storage.getItem(RAPPORT_PULSE_OPT_IN_KEY)));
}

/**
 * Switch the Pulse share on or off. Turning it off removes both the flag and
 * the mirror, so a stale copy cannot linger for Pulse (or anyone) to read.
 */
export function setRapportPulseOptIn(on: boolean, storage: StorageLike = defaultStorage()): void {
  try {
    if (on) {
      storage.setItem(RAPPORT_PULSE_OPT_IN_KEY, "1");
    } else {
      storage.removeItem(RAPPORT_PULSE_OPT_IN_KEY);
      storage.removeItem(RAPPORT_PULSE_HISTORY_KEY);
    }
  } catch {
    // IndexedDB remains the source of truth when shared storage is unavailable.
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike {
  if (typeof window === "undefined") return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  return window.localStorage;
}

function parseFlag(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/**
 * Publish the Pulse mirror, but only while the app's own opt-in flag is on.
 * The flag and the mirror it gates live under separate keys so there is one
 * source of truth: revoking it here stops the flow at the source.
 */
export function publishRapportPulseHistory(
  events: readonly DomainEvent[],
  simulations: readonly Simulation[] = [],
  storage: StorageLike = defaultStorage(),
): void {
  if (!readRapportPulseOptIn(storage)) return;
  try {
    storage.setItem(RAPPORT_PULSE_HISTORY_KEY, JSON.stringify(buildRapportPulseHistory(events, simulations)));
  } catch {
    // IndexedDB remains the source of truth when shared storage is unavailable.
  }
}
