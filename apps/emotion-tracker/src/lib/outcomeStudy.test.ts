import { describe, expect, it } from "vitest";
import { outcomeStudySummary, type OutcomeStudyEvent } from "./outcomeStudy";

describe("outcome study summary", () => {
  it("measures outcomes without needing reflection content", () => {
    const events: OutcomeStudyEvent[] = [
      { id: "1", type: "reflection_started", at: "2026-01-01T00:00:00.000Z", mode: "quick" },
      { id: "2", type: "reflection_completed", at: "2026-01-01T00:01:00.000Z", mode: "quick" },
      { id: "3", type: "follow_up_scheduled", at: "2026-01-01T00:01:00.000Z", mode: "quick" },
      { id: "4", type: "outcome_reviewed", at: "2026-01-03T00:01:00.000Z", mode: "quick", verdict: "unsupported" },
    ];
    expect(outcomeStudySummary(events)).toEqual({ started: 1, completed: 1, followUpsScheduled: 1, outcomesReviewed: 1 });
  });
});
