// Pure coverage reporting. Nothing here touches I/O or React — it reads
// curriculum + question bank and returns the numbers the status card needs.
import type { Id, Question, Topic } from "./types";

export interface SubjectCoverage {
  subjectId: Id;
  specVersion: string | null;
  lastChecked: string | null;
  coveragePercent: number;
  topicsTotal: number;
  topicsCovered: number;
  specPointsTotal: number;
  specPointsVerified: number;
  byVerification: Record<string, number>;
  retrievalItems: number;
  examQuestions: number;
  gaps: Array<{ topicId: Id; title: string; kind: "no-spec-points" | "no-cards" | "no-questions" }>;
}

export function coverageForSubject(
  topics: Topic[],
  questionsForSubject: Question[],
  cardsPerTopic: Map<Id, number>,
): SubjectCoverage {
  const subjectId = topics[0]?.subjectId ?? questionsForSubject[0]?.subjectId ?? "unknown";
  const specVersions = new Set(topics.map((t) => t.specVersion).filter(Boolean) as string[]);
  const specVersion = specVersions.size === 1 ? [...specVersions][0] : specVersions.size > 1 ? "mixed" : null;
  const lastChecked = topics.reduce<string | null>((best, t) => {
    if (!t.lastChecked) return best;
    if (!best) return t.lastChecked;
    return t.lastChecked > best ? t.lastChecked : best;
  }, null);
  const topicsTotal = topics.length;
  const specPointsTotal = topics.reduce((a, t) => a + (t.specPoints?.length ?? 0), 0);
  const specPointsVerified = topics.reduce(
    (a, t) => a + (t.specPoints?.filter(() => t.verification === "verified").length ?? 0),
    0,
  );
  const questionTopicIds = new Set(questionsForSubject.flatMap((q) => q.topicIds));
  let topicsCovered = 0;
  const byVerification: Record<string, number> = { verified: 0, checked: 0, unverified: 0 };
  const gaps: SubjectCoverage["gaps"] = [];
  for (const t of topics) {
    const hasCards = (cardsPerTopic.get(t.id) ?? 0) > 0;
    const hasQuestions = questionTopicIds.has(t.id);
    if (hasCards || hasQuestions || (t.specPoints?.length ?? 0) > 0) topicsCovered += 1;
    const v = t.verification ?? "unverified";
    byVerification[v] = (byVerification[v] ?? 0) + 1;
    if ((t.specPoints?.length ?? 0) === 0) gaps.push({ topicId: t.id, title: t.title, kind: "no-spec-points" });
    if (!hasCards) gaps.push({ topicId: t.id, title: t.title, kind: "no-cards" });
    if (!hasQuestions) gaps.push({ topicId: t.id, title: t.title, kind: "no-questions" });
  }
  const coveragePercent = topicsTotal === 0 ? 0 : Math.round((topicsCovered / topicsTotal) * 1000) / 10;
  const retrievalItems = [...cardsPerTopic.values()].reduce((a, n) => a + n, 0);
  const examQuestions = questionsForSubject.length;
  return {
    subjectId,
    specVersion,
    lastChecked,
    coveragePercent,
    topicsTotal,
    topicsCovered,
    specPointsTotal,
    specPointsVerified,
    byVerification,
    retrievalItems,
    examQuestions,
    gaps,
  };
}

export function coverageForAll(
  topicsBySubject: Map<Id, Topic[]>,
  questionsBySubject: Map<Id, Question[]>,
  cardsPerTopic: Map<Id, number>,
): Map<Id, SubjectCoverage> {
  const out = new Map<Id, SubjectCoverage>();
  for (const [subjectId, topics] of topicsBySubject.entries()) {
    out.set(subjectId, coverageForSubject(topics, questionsBySubject.get(subjectId) ?? [], cardsPerTopic));
  }
  return out;
}
