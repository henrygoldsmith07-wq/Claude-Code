import type { DomainEvent } from "@/domain/events";
import type { Simulation } from "@/domain/types";

export const RAPPORT_PULSE_HISTORY_KEY = "rapport.pulse-history.v2";
export const RAPPORT_PULSE_HISTORY_FORMAT = "le-studio.source-history";
export const RAPPORT_PULSE_HISTORY_VERSION = 2;

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

export function publishRapportPulseHistory(
  events: readonly DomainEvent[],
  simulations: readonly Simulation[] = [],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RAPPORT_PULSE_HISTORY_KEY,
      JSON.stringify(buildRapportPulseHistory(events, simulations)),
    );
  } catch {
    // IndexedDB remains the source of truth when shared storage is unavailable.
  }
}
