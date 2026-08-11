import type { AssessmentInsight, TopicMastery } from "./types";
import type { SubjectCoverage } from "./coverage";
import type { DependencyReport } from "./prerequisites";
import type { RetentionReport, MarksPerHourReport, TechniqueVsKnowledge, PaperAnalytics } from "./retention-analytics";
import type { GradePrediction } from "./grades";

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

export function retentionNarrative(report: RetentionReport): Narrative {
  const overall = report.overallRetention != null ? Math.round(report.overallRetention * 100) : null;
  const by1 = report.checkpoints.find((c) => c.checkpoint === 1);
  const by7 = report.checkpoints.find((c) => c.checkpoint === 7);
  const headline = overall != null ? `${overall}% retention over 30 days` : "Retention — not enough reviews yet";
  const paragraphs: string[] = [report.narrative];
  if (by1?.retention != null && by7?.retention != null) {
    const delta = Math.round((by7.retention - by1.retention) * 100);
    if (delta < -6) paragraphs.push(`Yesterday's recall was ${Math.round(by1.retention * 100)}% but the 7-day average is ${Math.round(by7.retention * 100)}% — you are forgetting faster than your intervals allow.`);
    else if (delta > 6) paragraphs.push(`Recall this week (${Math.round(by7.retention * 100)}%) is ahead of yesterday — your pacing is working.`);
    const gap = by7.gap;
    if (gap != null && gap > 0.12) paragraphs.push(`Predicted retention is ${Math.round((by7.predictedRetention ?? 0) * 100)}% but measured is ${Math.round(by7.retention * 100)}% — recalibrate intervals.`);
  }
  const bullets = report.checkpoints.map((c) => `${c.checkpoint}d: ${c.retention != null ? `${Math.round(c.retention * 100)}%` : "—"} (${c.reviews} reviews)`);
  return { headline, paragraphs, bullets };
}

export function marksPerHourNarrative(report: MarksPerHourReport): Narrative {
  const headline = report.headlineMarksPerHour != null ? `${report.headlineMarksPerHour.toFixed(1)} marks/hour (30d)` : "Marks-per-hour — not enough timed attempts";
  const paragraphs: string[] = [report.narrative];
  const by7 = report.points.find((p) => p.windowLabel === "7d");
  const by30 = report.points.find((p) => p.windowLabel === "30d");
  if (by7?.marksPerHour != null && by30?.marksPerHour != null && by7.marksPerHour > by30.marksPerHour * 1.2) {
    paragraphs.push(`This week is running at ${by7.marksPerHour.toFixed(1)}/hour vs ${by30.marksPerHour.toFixed(1)} over 30 days — momentum up. Keep targeting weak topics.`);
  } else if (by7?.marksPerHour != null && by30?.marksPerHour != null && by7.marksPerHour < by30.marksPerHour * 0.85) {
    paragraphs.push(`This week's pace (${by7.marksPerHour.toFixed(1)}/h) is below the 30-day average (${by30.marksPerHour.toFixed(1)}/h) — check whether recent topics are harder or sessions are unfocused.`);
  }
  const bullets = report.points.map((p) => `${p.windowLabel}: ${p.marksPerHour != null ? `${p.marksPerHour.toFixed(1)}/h` : "—"} · ${p.marksGained}/${p.marksAvailable} marks in ${p.hours.toFixed(1)}h`);
  return { headline, paragraphs, bullets };
}

export function techniqueVsKnowledgeNarrative(tk: TechniqueVsKnowledge): Narrative {
  const headline = tk.totalLost === 0 ? "Technique vs knowledge — no marks lost yet" : `${Math.round(tk.techniqueShare * 100)}% technique / ${Math.round(tk.knowledgeShare * 100)}% knowledge`;
  const paragraphs: string[] = [tk.narrative];
  if (!tk.reliable && tk.totalLost > 0) paragraphs.push("Evidence is still thin — this split will stabilise after ~8 marked mistakes.");
  if (tk.drivers.includes("rushing")) paragraphs.push("Several marks were lost while rushing — timing drills will help as much as content review.");
  if (tk.drivers.includes("time-management")) paragraphs.push("Some answers ran long — practising to a timer will convert those marks.");
  const bullets = [
    `Knowledge gap: ${tk.knowledgeLost} marks`,
    `Exam technique: ${tk.techniqueLost} marks`,
    tk.reliable ? "Reliable — 8+ mistakes, 10+ marks" : "Preliminary — keep practising to firm this up",
  ];
  return { headline, paragraphs, bullets };
}

export function paperBreakdownNarrative(papers: PaperAnalytics[], titleFor: (id: string) => string): Narrative | null {
  if (!papers.length) return null;
  const sorted = [...papers].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  if (papers.length === 1) {
    const p = papers[0];
    return {
      headline: `Paper-level: ${p.marksGained}/${p.marksAvailable} (${p.accuracy != null ? `${Math.round(p.accuracy * 100)}%` : "—"})`,
      paragraphs: [`Across ${p.attempts} attempts in ${p.hours.toFixed(1)}h. Worst topic: ${p.worstTopicId ? titleFor(p.worstTopicId) : "—"}.`],
      bullets: papers.map((x) => `${x.paperSpecId ?? x.subjectId}: ${x.marksGained}/${x.marksAvailable} · ${x.marksPerHour != null ? `${x.marksPerHour.toFixed(1)}/h` : "—"}`),
    };
  }
  return {
    headline: `Papers: weakest ${Math.round((weakest.accuracy ?? 0) * 100)}% · strongest ${Math.round((strongest.accuracy ?? 0) * 100)}%`,
    paragraphs: [`Weakest paper is ${weakest.paperSpecId ?? weakest.subjectId} (${Math.round((weakest.accuracy ?? 0) * 100)}%). Fix that paper's worst topic (${weakest.worstTopicId ? titleFor(weakest.worstTopicId) : "—"}) before rebalancing.`],
    bullets: sorted.slice(0, 4).map((p) => `${p.paperSpecId ?? p.subjectId}: ${p.marksGained}/${p.marksAvailable} · ${p.worstTopicId ? `worst ${titleFor(p.worstTopicId)}` : ""}`.trim()),
  };
}

export function gradeCalibrationNarrative(pred: GradePrediction): Narrative {
  const headline = `Predicted ${pred.grade} (${pred.percent}%) — range ${pred.worstCase}–${pred.bestCase}`;
  const paragraphs: string[] = [];
  if (pred.confidence < 0.45) paragraphs.push(`Low confidence (${Math.round(pred.confidence * 100)}%) — add more timed attempts to tighten this. Headroom: ${pred.headroom.map((h) => `${h.topicId} +${h.potentialPercent}%`).slice(0, 2).join(", ") || "—"}.`);
  else if (pred.confidence < 0.72) paragraphs.push(`Moderate confidence (${Math.round(pred.confidence * 100)}%). Best lever: ${pred.headroom[0] ? `${pred.headroom[0].topicId} (+${pred.headroom[0].potentialPercent}%)` : "a timed paper"}.`);
  else paragraphs.push(`Confident (${Math.round(pred.confidence * 100)}%). Remaining headroom is small — switch to timed papers and technique work.`);
  if (pred.trend > 4) paragraphs.push(`Trending up +${pred.trend}pp over the last 30 days.`);
  else if (pred.trend < -4) paragraphs.push(`Trending down ${pred.trend}pp — check whether recent topics are harder or revision slipped.`);
  const bullets = [
    `Confidence: ${Math.round(pred.confidence * 100)}%`,
    `Best case: ${pred.bestCase} · Worst case: ${pred.worstCase}`,
    ...pred.headroom.slice(0, 3).map((h) => `${h.topicId}: +${h.potentialPercent}% to grade`),
  ];
  return { headline, paragraphs, bullets };
}
