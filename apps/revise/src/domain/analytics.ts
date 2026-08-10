import type { AssessmentInsight, TopicMastery } from "./types";
import type { SubjectCoverage } from "./coverage";
import type { DependencyReport } from "./prerequisites";

// ---------------------------------------------------------------------------
// Analytics explanations — human narrative over raw numbers.
//
// Charts stay in the UI for those who want them; this module turns the same
// underlying data into one-paragraph explanations that actually answer
// "what should I do next and why?" Every function is pure so it is cheaply
// testable and the fallback path stays honest when there is almost no data.
// ---------------------------------------------------------------------------

export interface Narrative {
  headline: string;
  paragraphs: string[];
  bullets?: string[];
  cta?: string;
}

export function progressNarrative(input: {
  subjectLabel: string;
  masteryAvg: number;
  coverage: SubjectCoverage;
  weakCount: number;
  weakTop?: string;
}): Narrative {
  const pct = Math.round(input.masteryAvg * 100);
  const cov = input.coverage;
  const headline = `${input.subjectLabel}: ${pct}% mastery, ${cov.examQuestions} exam questions available`;
  const paragraphs: string[] = [];
  if (input.masteryAvg < 0.45) paragraphs.push(`You are still building the base in ${input.subjectLabel}. Focus on first-pass learning for the ${cov.topicsTotal - cov.topicsCovered} topics not yet covered, then close the ${input.weakCount} weak topics that are already costing marks.`);
  else if (input.masteryAvg < 0.7) paragraphs.push(`Solid middle ground. ${pct}% average with ${input.weakCount} topics still weak — those weak topics are where each hour buys the most marks.`);
  else paragraphs.push(`Strong position. Keep the spaced-repetition queue clear and spend remaining time on timed papers rather than new cards.`);
  if (input.weakTop) paragraphs.push(`Next best move: practice on ${input.weakTop}.`);
  const bullets = [
    `Statement coverage ${cov.statementCoverage}% (${cov.specPointsLearnable}/${cov.specPointsTotal} learnable)`,
    `Gaps: ${cov.gaps.length} flagged — see coverage panel`,
  ];
  return { headline, paragraphs, bullets, cta: input.weakTop ? `Practise ${input.weakTop}` : undefined };
}

export function assessmentNarrative(insight: AssessmentInsight, topicTitle: (id: string)=>string): Narrative {
  const topTopic = insight.marksLostByTopic[0];
  const headline = topTopic ? `Most marks are leaking in ${topicTitle(topTopic.topicId)} (${topTopic.lost} lost, ~${topTopic.recoverable} recoverable)` : "No marks lost yet — no mistakes recorded.";
  const paragraphs: string[] = [];
  if (!topTopic) { paragraphs.push("Answer a few exam questions and the diagnosis will populate — there is not enough evidence to rank topics yet."); return { headline, paragraphs }; }
  paragraphs.push(`In one focused hour on ${topicTitle(topTopic.topicId)} you can expect ~${insight.expectedMarksPerHour.find((x)=>x.topicId===topTopic.topicId)?.value ?? topTopic.recoverable} marks back. That is the fastest lever you have.`);
  const topAo = Object.entries(insight.marksLostByAo).sort((a,b)=>b[1]-a[1])[0];
  if (topAo && topAo[1] > 0) paragraphs.push(`By assessment objective the biggest loss is ${topAo[0]} (${topAo[1]} marks) — practise that AO's question types next.`);
  const bullets = insight.expectedMarksPerHour.slice(0,4).map((r)=> `${topicTitle(r.topicId)}: ${r.value} marks/hour`);
  return { headline, paragraphs, bullets, cta: `Fix ${topicTitle(topTopic.topicId)}` };
}

export function dependencyNarrative(report: DependencyReport[], title: (id:string)=>string): Narrative | null {
  const blocked = report.filter((r)=> r.blockedBy.some((b)=> b.weak));
  if (!blocked.length) return null;
  const first = blocked[0];
  const prereq = first.blockedBy.find((b)=> b.weak)!;
  return {
    headline: `${title(first.topicId)} is blocked by ${title(prereq.prerequisiteId)}`,
    paragraphs: [prereq.reason ? `${prereq.reason}. Fixing ${title(prereq.prerequisiteId)} first recovers more marks per hour than grinding ${title(first.topicId)} directly.` : `Fix ${title(prereq.prerequisiteId)} before ${title(first.topicId)} — it is the prerequisite.`],
    bullets: blocked.slice(0,3).map((r)=> `${title(r.topicId)} <- ${r.blockedBy.filter((b)=>b.weak).map((b)=>title(b.prerequisiteId)).join(", ")}`),
    cta: `Repair ${title(prereq.prerequisiteId)}`,
  };
}
