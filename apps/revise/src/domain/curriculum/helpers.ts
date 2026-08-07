import type { AoCode, ContentSource, Id, SpecPoint, Topic, Unit, VerificationStatus } from "../types";

export interface TopicSpec {
  slug: string;
  title: string;
  specRef?: string;
  specVersion?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  summary: string;
  keyPoints: string[];
  commonErrors: string[];
  specPoints?: SpecPoint[];
  aos?: AoCode[];
  source?: ContentSource;
  verification?: VerificationStatus;
  lastChecked?: string | null;
}

export interface UnitSpec {
  slug: string;
  title: string;
  topics: TopicSpec[];
}

/** Expand authored unit specs into the flat Unit/Topic records the app uses. */
export function buildUnits(subjectId: Id, specs: UnitSpec[]): { units: Unit[]; topics: Topic[] } {
  const units: Unit[] = [];
  const topics: Topic[] = [];
  let order = 0;

  specs.forEach((unitSpec, unitIndex) => {
    const unitId = `${subjectId}.${unitSpec.slug}`;
    units.push({ id: unitId, subjectId, title: unitSpec.title, order: unitIndex });
    for (const topicSpec of unitSpec.topics) {
      topics.push({
        id: `${subjectId}.${topicSpec.slug}`,
        subjectId,
        unitId,
        title: topicSpec.title,
        order: order++,
        specRef: topicSpec.specRef,
        specVersion: topicSpec.specVersion,
        intrinsicDifficulty: topicSpec.difficulty,
        summary: topicSpec.summary,
        keyPoints: topicSpec.keyPoints,
        commonErrors: topicSpec.commonErrors,
        specPoints: topicSpec.specPoints,
        aos: topicSpec.aos,
        source: topicSpec.source ?? "authored",
        verification: topicSpec.verification ?? "unverified",
        lastChecked: topicSpec.lastChecked ?? null,
      });
    }
  });

  return { units, topics };
}

/** A-level style boundaries — approximate, and labelled as such in the UI. */
export const A_LEVEL_BOUNDARIES = [
  { grade: "A*", percent: 80 },
  { grade: "A", percent: 70 },
  { grade: "B", percent: 60 },
  { grade: "C", percent: 50 },
  { grade: "D", percent: 40 },
  { grade: "E", percent: 30 },
  { grade: "U", percent: 0 },
];
