import {
  designExperiment,
  type Condition,
  type DesignOptions,
  type ExperimentDesign,
  type ExperimentType,
} from "./design.js";
import type { Hypothesis } from "../hypotheses/tracker.js";

export interface ExperimentTemplate {
  id: string;
  version: number;
  name: string;
  description: string;
  type: ExperimentType;
  defaults: {
    sessionsPerWeek: number;
    blockDays: number;
    maxDurationDays: number;
  };
  conditionA: Condition;
  conditionB: Condition;
  caveats: string[];
}

export interface ExperimentTemplateOptions {
  startDate: string;
  sessionsPerWeek?: number;
  blockDays?: number;
  minSamplePerCondition?: number;
  seed?: string;
  now?: () => number;
  conditionA?: Partial<Omit<Condition, "id">>;
  conditionB?: Partial<Omit<Condition, "id">>;
  maxDurationDays?: number;
}

export const EXPERIMENT_TEMPLATES: readonly ExperimentTemplate[] = [
  {
    id: "crossover-weekly-v1",
    version: 1,
    name: "Weekly crossover",
    description: "Alternate seven-day intervention and control blocks so time trends affect both conditions.",
    type: "crossover",
    defaults: { sessionsPerWeek: 4, blockDays: 7, maxDurationDays: 56 },
    conditionA: {
      id: "A",
      label: "Intervention",
      instruction: "Deliberately do the behaviour under test before each session.",
    },
    conditionB: {
      id: "B",
      label: "Control",
      instruction: "Keep everything else the same, but do not do the behaviour under test.",
    },
    caveats: ["Carry-over between blocks can blur the contrast.", "Keep the intervention stable throughout the run."],
  },
  {
    id: "balanced-daily-ab-v1",
    version: 1,
    name: "Balanced daily A/B",
    description: "Randomise a balanced intervention or control assignment on each eligible day.",
    type: "ab",
    defaults: { sessionsPerWeek: 5, blockDays: 1, maxDurationDays: 42 },
    conditionA: {
      id: "A",
      label: "Intervention",
      instruction: "Deliberately do the behaviour under test before each session.",
    },
    conditionB: {
      id: "B",
      label: "Control",
      instruction: "Keep everything else the same, but do not do the behaviour under test.",
    },
    caveats: ["Short runs can still be affected by day-to-day drift.", "Follow the assignment rather than choosing the easier condition."],
  },
  {
    id: "before-after-baseline-v1",
    version: 1,
    name: "Before/after baseline",
    description: "Run a baseline period followed by an intervention period when alternating is not practical.",
    type: "before-after",
    defaults: { sessionsPerWeek: 4, blockDays: 1, maxDurationDays: 28 },
    conditionA: {
      id: "A",
      label: "After / intervention",
      instruction: "Do the behaviour under test before each session in the second period.",
    },
    conditionB: {
      id: "B",
      label: "Before / baseline",
      instruction: "Do not do the behaviour under test during the baseline period.",
    },
    caveats: ["The change cannot be separated from general improvement or other changes over time.", "Use this only when crossover and daily A/B are not practical."],
  },
];

export function listExperimentTemplates(): ExperimentTemplate[] {
  return EXPERIMENT_TEMPLATES.map(copyTemplate);
}

export function getExperimentTemplate(id: string): ExperimentTemplate | undefined {
  const template = EXPERIMENT_TEMPLATES.find((candidate) => candidate.id === id);
  return template ? copyTemplate(template) : undefined;
}

export function instantiateExperimentTemplate(
  hypothesis: Hypothesis,
  templateId: string,
  options: ExperimentTemplateOptions,
): ExperimentDesign {
  const template = getExperimentTemplate(templateId);
  if (!template) throw new Error(`Unknown experiment template: ${templateId}`);

  const designOptions: DesignOptions = {
    type: template.type,
    startDate: options.startDate,
    sessionsPerWeek: options.sessionsPerWeek ?? template.defaults.sessionsPerWeek,
    blockDays: options.blockDays ?? template.defaults.blockDays,
    minSamplePerCondition: options.minSamplePerCondition,
    seed: options.seed ?? `${template.id}:${hypothesis.id}:${options.startDate}`,
    conditionA: { ...template.conditionA, ...options.conditionA },
    conditionB: { ...template.conditionB, ...options.conditionB },
    maxDurationDays: options.maxDurationDays ?? template.defaults.maxDurationDays,
    templateId: template.id,
    templateVersion: template.version,
    ...(options.now ? { now: options.now } : {}),
  };

  return designExperiment(hypothesis, designOptions);
}

export function designExperimentFromTemplate(
  hypothesis: Hypothesis,
  templateId: string,
  options: ExperimentTemplateOptions,
): ExperimentDesign {
  return instantiateExperimentTemplate(hypothesis, templateId, options);
}

function copyTemplate(template: ExperimentTemplate): ExperimentTemplate {
  return {
    ...template,
    defaults: { ...template.defaults },
    conditionA: { ...template.conditionA },
    conditionB: { ...template.conditionB },
    caveats: [...template.caveats],
  };
}
