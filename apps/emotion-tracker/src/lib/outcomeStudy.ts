import type { AssumptionVerdict, ReflectionMode } from "./types";

export const OUTCOME_STUDY_OPT_IN_KEY = "reflectOutcomeStudyOptIn";
export const OUTCOME_STUDY_EVENTS_KEY = "reflectOutcomeStudyEvents";
const MAX_STUDY_EVENTS = 5000;

export type OutcomeStudyEventType =
  | "reflection_started"
  | "reflection_completed"
  | "follow_up_scheduled"
  | "outcome_reviewed"
  | "pattern_corrected"
  | "focus_mode_used";

export interface OutcomeStudyEvent {
  id: string;
  type: OutcomeStudyEventType;
  at: string;
  mode?: ReflectionMode;
  verdict?: AssumptionVerdict;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function isOutcomeStudyOptIn(): boolean {
  return canUseStorage() && window.localStorage.getItem(OUTCOME_STUDY_OPT_IN_KEY) === "1";
}

export function setOutcomeStudyOptIn(value: boolean): void {
  if (!canUseStorage()) return;
  if (value) window.localStorage.setItem(OUTCOME_STUDY_OPT_IN_KEY, "1");
  else {
    window.localStorage.removeItem(OUTCOME_STUDY_OPT_IN_KEY);
    window.localStorage.removeItem(OUTCOME_STUDY_EVENTS_KEY);
  }
}

export function getOutcomeStudyEvents(): OutcomeStudyEvent[] {
  if (!canUseStorage()) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OUTCOME_STUDY_EVENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event): event is OutcomeStudyEvent => {
      if (typeof event !== "object" || event === null) return false;
      const row = event as Record<string, unknown>;
      return typeof row.id === "string" && typeof row.type === "string" && typeof row.at === "string";
    });
  } catch {
    return [];
  }
}

export function logOutcomeStudyEvent(
  event: Omit<OutcomeStudyEvent, "id" | "at"> & { at?: string },
): void {
  if (!isOutcomeStudyOptIn()) return;
  const next: OutcomeStudyEvent = {
    ...event,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    at: event.at ?? new Date().toISOString(),
  };
  const events = [...getOutcomeStudyEvents(), next].slice(-MAX_STUDY_EVENTS);
  window.localStorage.setItem(OUTCOME_STUDY_EVENTS_KEY, JSON.stringify(events));
}

export function clearOutcomeStudyEvents(): void {
  if (canUseStorage()) window.localStorage.removeItem(OUTCOME_STUDY_EVENTS_KEY);
}

export function outcomeStudySummary(events: OutcomeStudyEvent[] = getOutcomeStudyEvents()) {
  return {
    started: events.filter((event) => event.type === "reflection_started").length,
    completed: events.filter((event) => event.type === "reflection_completed").length,
    followUpsScheduled: events.filter((event) => event.type === "follow_up_scheduled").length,
    outcomesReviewed: events.filter((event) => event.type === "outcome_reviewed").length,
  };
}
