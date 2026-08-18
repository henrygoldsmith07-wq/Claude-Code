import { observationsFor } from "../metrics/compute.js";
import type { MetricRegistry } from "../metrics/registry.js";
import type { Assignment, ExperimentDesign } from "./design.js";
import type { PulseEvent } from "../events/schema.js";

export const MISSING_DATA_REASONS = [
  { id: "device-off", label: "Device was off", detail: "No measurement because the recording device was unavailable." },
  { id: "travel", label: "Travel / unusual day", detail: "The day was outside the normal routine." },
  { id: "forgot", label: "Forgot to measure", detail: "The assigned condition ran, but the measurement was missed." },
  { id: "illness", label: "Illness / recovery", detail: "The day was not comparable because health changed the routine." },
  { id: "connector-gap", label: "Connector gap", detail: "The source did not deliver a measurement to Pulse." },
  { id: "other", label: "Other", detail: "A different reason was recorded by the user." },
] as const;

export type MissingDataReason = (typeof MISSING_DATA_REASONS)[number]["id"];

export interface InvalidExperimentDay {
  date: string;
  condition: Assignment["condition"];
  reason: "missing-measurement";
  defaultClassification: MissingDataReason;
}

/** Finds assigned days whose target measure never arrived in the run window. */
export function detectInvalidExperimentDays(
  design: ExperimentDesign,
  events: readonly PulseEvent[],
  registry: MetricRegistry,
): InvalidExperimentDay[] {
  const observations = observationsFor(events, registry.require(design.targetMetricId));
  const measuredDates = new Set(
    observations
      .filter((observation) => observation.localDate >= design.startDate && observation.localDate <= design.endDate)
      .map((observation) => observation.localDate),
  );

  return design.assignments
    .filter((assignment) => !measuredDates.has(assignment.date))
    .map((assignment) => ({
      date: assignment.date,
      condition: assignment.condition,
      reason: "missing-measurement" as const,
      defaultClassification: "connector-gap" as const,
    }));
}
