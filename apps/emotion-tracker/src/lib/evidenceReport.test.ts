import { describe, expect, it } from "vitest";
import type { Entry, ReflectionSummary, StructuredTrace } from "./types";
import {
  buildLongitudinalEvidenceReport,
  renderLongitudinalEvidenceReportMarkdown,
} from "./evidenceReport";

function trace(overrides: Partial<StructuredTrace> = {}): StructuredTrace {
  return {
    event: "Manager gave feedback",
    observations: ["Manager said more detail would help"],
    assumptions: ["They think I am incompetent"],
    namedEmotion: "shame",
    alternativeInterpretations: ["Manager wanted faster handovers"],
    intendedOutcome: "Feel trusted",
    intendedAction: "Ask for an example",
    predictedOutcome: "They will give an example and I will feel clearer",
    followUpAt: "2026-01-20",
    followUpNote: null,
    ...overrides,
  };
}

function summary(overrides: Partial<ReflectionSummary> = {}, t: Partial<StructuredTrace> = {}): ReflectionSummary {
  return {
    trace: trace(t),
    coreEmotion: "shame",
    underlyingTriggers: ["Critical feedback"],
    possibleBiases: [],
    otherPerspective: "Routine coaching",
    balancedAssessment: "Blunt but not personal",
    cautionFlags: [],
    suggestedNextSteps: ["Ask"],
    hedgedDisclaimer: null,
    ...overrides,
  };
}

function entry(id: string, createdAt: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    createdAt,
    title: `Reflection ${id}`,
    messages: [{ role: "user", content: `private conversation ${id}` }],
    status: "complete",
    summary: summary(),
    ...overrides,
  };
}

describe("longitudinal evidence reports", () => {
  it("builds a versioned report with linked evidence and trend totals", () => {
    const first = entry("jan", "2026-01-05T12:00:00.000Z", {
      longitudinalReview: {
        actualActionTaken: "Asked for an example",
        actualOutcome: "They clarified the request",
        assumptionVerdict: "unsupported",
        calibrationNote: "The first reading was too personal",
        reviewedAt: "2026-01-10T12:00:00.000Z",
      },
    });
    const second = entry("feb", "2026-02-05T12:00:00.000Z", {
      summary: summary({ coreEmotion: "calm" }, { followUpAt: "2026-02-20" }),
    });
    const report = buildLongitudinalEvidenceReport([first, second], {
      generatedAt: "2026-03-01T12:00:00.000Z",
    });

    expect(report.format).toBe("reflect.longitudinal-evidence-report");
    expect(report.schemaVersion).toBe(1);
    expect(report.summary).toMatchObject({ totalEntries: 2, completedEntries: 2, reviewedEntries: 1 });
    expect(report.range).toEqual({ from: "2026-01-05", to: "2026-02-05" });
    expect(report.timeline.map((period) => period.period)).toEqual(["2026-01", "2026-02"]);
    expect(report.calibration.unsupported).toBe(1);
    expect(report.evidence.observations).toBe(2);
    expect(report.evidence.linkedObservations).toBe(2);
    expect(report.evidence.records[0].entryId).toBe("jan");
    expect(report.findings.every((finding) => finding.entryIds.length > 0)).toBe(true);
  });

  it("filters by an inclusive date window and excludes incomplete entries from evidence", () => {
    const before = entry("before", "2026-01-31T23:59:59.000Z");
    const inside = entry("inside", "2026-02-01T00:00:00.000Z");
    const incomplete = entry("incomplete", "2026-02-10T12:00:00.000Z", { status: "in_progress", summary: null });
    const after = entry("after", "2026-03-01T00:00:00.000Z");

    const report = buildLongitudinalEvidenceReport([before, inside, incomplete, after], {
      from: "2026-02-01",
      to: "2026-02-28",
      generatedAt: "2026-03-01T12:00:00.000Z",
    });

    expect(report.summary.totalEntries).toBe(2);
    expect(report.summary.completedEntries).toBe(1);
    expect(report.evidence.records.map((record) => record.entryId)).toEqual(["inside"]);
    expect(report.timeline).toHaveLength(1);
    expect(report.timeline[0].entryIds).toEqual(["inside"]);
  });

  it("keeps message content out of the report while preserving structured evidence", () => {
    const report = buildLongitudinalEvidenceReport([
      entry("private", "2026-01-05T12:00:00.000Z", {
        messages: [{ role: "user", content: "This private transcript must never be exported in the report" }],
        summary: summary({}, {
          observations: ["More detail was requested"],
          assumptions: ["More detail means I am incompetent"],
        }),
      }),
    ], { generatedAt: "2026-01-06T12:00:00.000Z" });

    const serialised = JSON.stringify(report);
    expect(serialised).not.toContain("private transcript");
    expect(report.evidence.records[0]).not.toHaveProperty("messages");
    expect(report.evidence.records[0].observations).toEqual(["More detail was requested"]);
    expect(report.evidence.records[0].links[0].linkedAssumptions).toContain("More detail means I am incompetent");
  });

  it("renders a readable Markdown report with evidence citations", () => {
    const report = buildLongitudinalEvidenceReport([entry("a", "2026-01-05T12:00:00.000Z")], {
      generatedAt: "2026-01-06T12:00:00.000Z",
    });
    const markdown = renderLongitudinalEvidenceReportMarkdown(report);

    expect(markdown).toContain("# Longitudinal evidence report");
    expect(markdown).toContain("## Evidence timeline");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("Evidence: `a`");
    expect(markdown).not.toContain("private conversation");
  });

  it("returns a safe empty report when there are no completed reflections", () => {
    const report = buildLongitudinalEvidenceReport([
      entry("draft", "2026-01-05T12:00:00.000Z", { status: "in_progress", summary: null }),
    ], { generatedAt: "2026-01-06T12:00:00.000Z" });

    expect(report.summary).toMatchObject({ totalEntries: 1, completedEntries: 0, reviewedEntries: 0 });
    expect(report.range).toEqual({ from: "2026-01-05", to: "2026-01-05" });
    expect(report.timeline).toEqual([]);
    expect(report.evidence.records).toEqual([]);
    expect(renderLongitudinalEvidenceReportMarkdown(report)).toContain("No completed reflections in this window");
  });
});
