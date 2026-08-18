import { describe, expect, it } from "vitest";
import { Pulse } from "../src/pulse.js";
import type { Hypothesis } from "../src/hypotheses/tracker.js";
import {
  getExperimentTemplate,
  instantiateExperimentTemplate,
  listExperimentTemplates,
} from "../src/experiments/templates.js";

const NOW = Date.parse("2025-07-01T12:00:00Z");
const clock = (): number => NOW;

const hypothesis: Hypothesis = {
  id: "hyp-template",
  createdAt: "2025-07-01T12:00:00.000Z",
  updatedAt: "2025-07-01T12:00:00.000Z",
  statement: "If I practise before a session, accuracy will increase by about 0.45 standard deviations.",
  originFindingId: null,
  exposureMetricId: "study.practice",
  outcomeMetricId: "study.accuracy",
  predictedDirection: "increase",
  predictedEffect: 0.45,
  status: "proposed",
  history: [{ from: null, to: "proposed", at: "2025-07-01T12:00:00.000Z", reason: "Test hypothesis" }],
  experimentIds: [],
  knownConfounders: ["Improvement over time"],
};

describe("experiment templates", () => {
  it("exposes a stable, versioned catalogue with all supported design types", () => {
    const templates = listExperimentTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "crossover-weekly-v1",
      "balanced-daily-ab-v1",
      "before-after-baseline-v1",
    ]);
    expect(new Set(templates.map((template) => template.type)).size).toBe(3);
    expect(templates.every((template) => template.version === 1)).toBe(true);
    expect(templates.every((template) => template.conditionA.id === "A" && template.conditionB.id === "B")).toBe(true);
    expect(getExperimentTemplate("crossover-weekly-v1")?.name).toBe("Weekly crossover");
    expect(getExperimentTemplate("does-not-exist")).toBeUndefined();
  });

  it("instantiates a template with its defaults and records the template version", () => {
    const design = instantiateExperimentTemplate(hypothesis, "balanced-daily-ab-v1", {
      startDate: "2025-07-07",
      now: clock,
      conditionA: { label: "With deliberate practice" },
    });

    expect(design.type).toBe("ab");
    expect(design.blockDays).toBe(1);
    expect(design.conditionA.label).toBe("With deliberate practice");
    expect(design.templateId).toBe("balanced-daily-ab-v1");
    expect(design.templateVersion).toBe(1);
    expect(design.seed).toContain("balanced-daily-ab-v1");
  });

  it("keeps different templates as distinct reproducible designs", () => {
    const crossover = instantiateExperimentTemplate(hypothesis, "crossover-weekly-v1", {
      startDate: "2025-07-07",
      now: clock,
    });
    const beforeAfter = instantiateExperimentTemplate(hypothesis, "before-after-baseline-v1", {
      startDate: "2025-07-07",
      now: clock,
    });

    expect(crossover.id).not.toBe(beforeAfter.id);
    expect(crossover.id).toBe(
      instantiateExperimentTemplate(hypothesis, "crossover-weekly-v1", {
        startDate: "2025-07-07",
        now: clock,
      }).id,
    );
  });

  it("rejects an unknown template instead of silently falling back", () => {
    expect(() =>
      instantiateExperimentTemplate(hypothesis, "missing-template", {
        startDate: "2025-07-07",
        now: clock,
      }),
    ).toThrow(/Unknown experiment template/);
  });
});

describe("Pulse template integration", () => {
  it("lists templates and links a templated design to its hypothesis and export", () => {
    const pulse = new Pulse({ now: clock });
    pulse.hypotheses.add({ ...hypothesis, history: [...hypothesis.history], experimentIds: [] });

    const design = pulse.designExperimentFromTemplate(hypothesis.id, "crossover-weekly-v1", {
      startDate: "2025-07-07",
    });

    expect(pulse.listExperimentTemplates().map((template) => template.id)).toContain("crossover-weekly-v1");
    expect(pulse.getDesign(design.id)).toEqual(design);
    expect(pulse.hypotheses.get(hypothesis.id)?.status).toBe("testing");
    expect(pulse.hypotheses.get(hypothesis.id)?.experimentIds).toContain(design.id);
    expect(pulse.export().experimentDesigns).toContainEqual(expect.objectContaining({
      id: design.id,
      templateId: "crossover-weekly-v1",
      templateVersion: 1,
    }));
  });
});
