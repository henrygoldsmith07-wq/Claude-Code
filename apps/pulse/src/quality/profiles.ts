import type { PulseEvent, SourceId } from "../events/schema.js";
import type { SourceQuality } from "./score.js";

export interface ReliabilityProfile {
  id: string;
  name: string;
  kind: "source" | "device";
  score: number | null;
  status: "strong" | "watch" | "unrated";
  eventCount: number;
  evidence: string[];
}

/**
 * Presents reliability as an explainable profile, not a single opaque badge.
 * Source scores come from the quality engine; device rows stay unrated when
 * the source did not provide an attribution we can validate.
 */
export function buildReliabilityProfiles(
  qualities: readonly SourceQuality[],
  events: readonly PulseEvent[],
): { sources: ReliabilityProfile[]; devices: ReliabilityProfile[] } {
  const sourceProfiles = qualities.map((quality) => ({
    id: String(quality.source),
    name: sourceName(quality.source),
    kind: "source" as const,
    score: quality.score,
    status: statusForScore(quality.score),
    eventCount: quality.eventCount,
    evidence: [
      `${quality.grade} data quality across ${quality.daysWithData} of ${quality.coverageDays} covered days`,
      ...quality.dimensions.map((dimension) => `${dimension.id}: ${Math.round(dimension.score * 100)}%`),
    ],
  }));

  const qualityBySource = new Map(qualities.map((quality) => [String(quality.source), quality.score]));
  const deviceEvents = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const device = typeof event.attributes.origin_device === "string" ? event.attributes.origin_device : null;
    const key = device ?? `source:${event.source}`;
    const bucket = deviceEvents.get(key) ?? [];
    bucket.push(event);
    deviceEvents.set(key, bucket);
  }

  const deviceProfiles = [...deviceEvents.entries()].map(([id, deviceEventsForId]) => {
    const sourceScores = deviceEventsForId
      .map((event) => qualityBySource.get(String(event.source)))
      .filter((score): score is number => score !== undefined);
    const score = sourceScores.length ? sourceScores.reduce((sum, value) => sum + value, 0) / sourceScores.length : null;
    const attributed = !id.startsWith("source:");
    return {
      id,
      name: attributed ? id : `${sourceName(deviceEventsForId[0]!.source)} device attribution`,
      kind: "device" as const,
      score,
      status: attributed && score !== null ? statusForScore(score) : "unrated" as const,
      eventCount: deviceEventsForId.length,
      evidence: attributed
        ? [`Observed in ${deviceEventsForId.length} measurements`, "Attribution came from the source payload"]
        : ["The source did not include a device identifier", "Reliability is only known at source level"],
    };
  });

  return { sources: sourceProfiles, devices: deviceProfiles };
}

function statusForScore(score: number): ReliabilityProfile["status"] {
  return score >= 0.65 ? "strong" : score >= 0.45 ? "watch" : "unrated";
}

function sourceName(source: SourceId): string {
  return String(source)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
