/**
 * Ask Pulse — answering.
 *
 * Every answer is assembled from computed values. The AI layer may restate an
 * answer afterwards, under the numeric guard, but it never produces one.
 *
 * "I don't have enough data to answer that" is a first-class answer and is
 * returned far more often than a demo would like. An analytics tool that
 * always has an answer is an analytics tool that is sometimes making one up.
 */

import type { PulseEvent } from "../events/schema.js";
import type { MetricRegistry } from "../metrics/registry.js";
import { dailySeries, groupByAttribute, observationsFor, timeBucket } from "../metrics/compute.js";
import { analyseTrend } from "../timeseries/trend.js";
import { summariseStreaks } from "../timeseries/baseline.js";
import { mean, round, summarise } from "../statistics/descriptive.js";
import { compareGroups } from "../statistics/comparisons.js";
import type { Finding } from "../discovery/finding.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import { parseQuestion, type Intent, type ParsedQuestion } from "./intents.js";

export interface AnswerEvidence {
  description: string;
  sampleSize: number;
  metricIds: string[];
}

export interface Answer {
  question: string;
  intent: Intent;
  /** The answer text, deterministically composed. */
  statement: string;
  /** Findings that back the answer, if any. */
  findings: Finding[];
  evidence: AnswerEvidence[];
  caveats: string[];
  /** True when Pulse declined to answer. */
  declined: boolean;
  parse: ParsedQuestion;
}

export interface AskContext {
  events: readonly PulseEvent[];
  registry: MetricRegistry;
  findings: readonly Finding[];
  recommendations?: readonly Recommendation[];
  hypotheses?: readonly Hypothesis[];
  /** Deterministic "today" for week-based questions. */
  today?: string;
  weeklyBriefHeadline?: string;
}

const DECLINE_CAVEAT = "Pulse only answers questions it can support with your own data.";

/** Matches the discovery engine's independence floor — see discovery/candidates. */
const MIN_DISTINCT_DAYS = 14;

export function ask(question: string, context: AskContext): Answer {
  const parse = parseQuestion(question, context.registry);
  const base = { question, intent: parse.intent, findings: [], evidence: [], caveats: [], declined: false, parse };

  switch (parse.intent) {
    case "best-time":
      return answerBestTime(context, parse, base);
    case "does-x-affect-y":
      return answerRelationship(context, parse, base);
    case "best-method":
      return answerBestMethod(context, parse, base);
    case "predicts-missed":
      return answerMissedSessions(context, parse, base);
    case "precedes-strong-days":
      return answerPrecedingBehaviours(context, parse, base);
    case "what-changed":
      return answerWhatChanged(context, base);
    case "what-to-test":
      return answerWhatToTest(context, base);
    case "metric-summary":
      return answerMetricSummary(context, parse, base);
    default:
      return {
        ...base,
        statement:
          "I could not tell what that question is asking about. Try naming a metric — for example \"when do I revise most effectively?\" or \"does exercise affect study accuracy?\".",
        declined: true,
        caveats: [DECLINE_CAVEAT],
      };
  }
}

type Base = Omit<Answer, "statement">;

function decline(base: Base, reason: string): Answer {
  return { ...base, statement: reason, declined: true, caveats: [DECLINE_CAVEAT] };
}

function answerBestTime(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const metricId = parse.outcomeMetricId ?? "study.accuracy";
  const definition = context.registry.get(metricId);
  if (!definition) return decline(base, `I do not track a metric matching that question.`);

  const observations = observationsFor(context.events, definition).filter(
    (observation) => observation.attributes.time_estimated !== true,
  );
  if (observations.length < definition.minSampleForInsight) {
    return decline(
      base,
      `I have ${observations.length} sessions with a recorded time for ${definition.name.toLowerCase()}, and I need at least ${definition.minSampleForInsight} before comparing times of day.`,
    );
  }

  // The same independence floor the discovery engine applies: a dozen reviews
  // in one sitting is one sitting, and answering from three days of data would
  // be confident nonsense.
  const distinctDays = new Set(observations.map((observation) => observation.localDate)).size;
  if (distinctDays < MIN_DISTINCT_DAYS) {
    return decline(
      base,
      `Your ${observations.length} timed sessions come from only ${distinctDays} different days. Sessions on the same day are not independent evidence, so I need at least ${MIN_DISTINCT_DAYS} days before comparing times of day.`,
    );
  }

  const buckets = new Map<string, number[]>();
  for (const observation of observations) {
    const key = timeBucket(observation.localMinutes);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(observation.value);
    else buckets.set(key, [observation.value]);
  }
  const usable = [...buckets.entries()].filter(([, values]) => values.length >= 8);
  if (usable.length < 2) return decline(base, "Your sessions are concentrated in one part of the day, so there is nothing to compare.");

  const ranked = usable
    .map(([key, values]) => ({ key, n: values.length, mean: mean(values), values }))
    .sort((a, b) => (definition.direction === "lower-better" ? a.mean - b.mean : b.mean - a.mean));

  const best = ranked[0]!;
  const rest = observations.filter((observation) => timeBucket(observation.localMinutes) !== best.key).map((o) => o.value);
  const comparison = compareGroups(best.values, rest);

  const supporting = context.findings.filter(
    (finding) => finding.tags.includes("time-of-day") && finding.metricIds.includes(metricId),
  );

  const statement = [
    `Your ${definition.name.toLowerCase()} is highest in the ${best.key.replace(/-/g, " ")} (${formatValue(best.mean, definition.format)} across ${best.n} sessions), against ${formatValue(mean(rest), definition.format)} at other times.`,
    comparison.insufficient
      ? "The difference is not large enough relative to the noise to call it real."
      : `That gap is ${comparison.pValue < 0.05 ? "unlikely to be chance" : "within the range chance could produce"} (p = ${round(comparison.pValue, 3)}, ${comparison.effect.label}).`,
    "This is an observed pattern in when you happened to work, not proof that the time itself is responsible.",
  ].join(" ");

  return {
    ...base,
    statement,
    findings: supporting,
    evidence: [{ description: `${observations.length} timed sessions across ${ranked.length} parts of the day`, sampleSize: observations.length, metricIds: [metricId] }],
    caveats: [
      "Sessions at different times may also differ in what you were working on and how tired you were.",
      ...(comparison.insufficient ? [comparison.insufficient] : []),
    ],
  };
}

function answerRelationship(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const outcomeId = parse.outcomeMetricId;
  const exposureId = parse.exposureMetricId;
  if (!outcomeId || !exposureId) {
    return decline(base, "I need two things to compare. Try naming both, for example \"does exercise affect study accuracy?\".");
  }

  const matching = context.findings.filter(
    (finding) => finding.metricIds.includes(outcomeId) && finding.metricIds.includes(exposureId),
  );

  if (matching.length === 0) {
    const outcome = context.registry.get(outcomeId);
    const exposure = context.registry.get(exposureId);
    return {
      ...base,
      statement: `I looked at ${exposure?.name.toLowerCase() ?? exposureId} against ${outcome?.name.toLowerCase() ?? outcomeId} and did not find a relationship strong enough to report after accounting for everything else I tested. That is not the same as proving there is no relationship — it may simply be too small or too early to see.`,
      declined: false,
      caveats: [
        "A null result here is weak evidence: with the data available, only a fairly large effect would have been detectable.",
      ],
    };
  }

  const strongest = matching[0]!;
  return {
    ...base,
    statement: `${strongest.statement} ${strongest.causalityNote}`,
    findings: matching,
    evidence: strongest.evidence.map((reference) => ({
      description: reference.description,
      sampleSize: reference.eventCount,
      metricIds: reference.metricIds,
    })),
    caveats: [
      ...strongest.confidence.limitations,
      ...strongest.confounders.filter((c) => c.status === "uncontrolled").map((c) => `${c.name}: ${c.detail}`),
    ],
  };
}

function answerBestMethod(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const metricId = parse.outcomeMetricId ?? "study.delayed_recall";
  const definition = context.registry.get(metricId);
  if (!definition) return decline(base, "I do not track a metric matching that question.");

  const observations = observationsFor(context.events, definition);
  const groups = groupByAttribute(observations, "method");
  const usable = [...groups.entries()].filter(([, items]) => items.length >= 10);
  if (usable.length < 2) {
    return decline(base, `I need at least 10 sessions of each method before comparing them; I have ${usable.length} method(s) with enough data.`);
  }

  const ranked = usable
    .map(([method, items]) => ({ method, n: items.length, mean: mean(items.map((o) => o.value)) }))
    .sort((a, b) => (definition.direction === "lower-better" ? a.mean - b.mean : b.mean - a.mean));

  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;

  return {
    ...base,
    statement: `On ${definition.name.toLowerCase()}, ${best.method} comes out ahead at ${formatValue(best.mean, definition.format)} across ${best.n} sessions, against ${formatValue(worst.mean, definition.format)} for ${worst.method} (${worst.n} sessions). You chose which method to use each time, so the methods were not applied to comparable material — treat this as a lead to test, not a verdict.`,
    findings: context.findings.filter((finding) => finding.tags.includes("attribute-split") && finding.metricIds.includes(metricId)),
    evidence: ranked.map((row) => ({ description: `${row.method}: ${row.n} sessions`, sampleSize: row.n, metricIds: [metricId] })),
    caveats: ["You likely picked easier or harder material for different methods, which alone could produce this gap."],
  };
}

function answerMissedSessions(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const metricId = parse.outcomeMetricId ?? "study.session_minutes";
  const definition = context.registry.get(metricId);
  if (!definition) return decline(base, "I do not track a metric matching that question.");

  const series = dailySeries(context.events, definition, { fillGaps: true, zeroFillEmptyDays: true });
  const streaks = summariseStreaks(series);
  if (streaks.totalDays < 21) {
    return decline(base, `I have ${streaks.totalDays} days of history, and I need about three weeks before gaps mean anything.`);
  }

  const missedDates = new Set(series.dates.filter((_, i) => (series.counts[i] ?? 0) === 0));
  if (missedDates.size < 5) {
    return {
      ...base,
      statement: `You have missed only ${missedDates.size} of ${streaks.totalDays} days, which is not enough missed days to find a pattern in. Your longest run is ${streaks.longestStreak} days and your longest gap ${streaks.longestGap}.`,
      evidence: [{ description: `${streaks.activeDays} active days of ${streaks.totalDays}`, sampleSize: streaks.totalDays, metricIds: [metricId] }],
      caveats: [],
    };
  }

  // Which day of week is over-represented among missed days?
  const missedByDow = new Array<number>(7).fill(0);
  const totalByDow = new Array<number>(7).fill(0);
  for (const date of series.dates) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    totalByDow[dow] = (totalByDow[dow] ?? 0) + 1;
    if (missedDates.has(date)) missedByDow[dow] = (missedByDow[dow] ?? 0) + 1;
  }
  const rates = missedByDow.map((missed, dow) => ({ dow, rate: (totalByDow[dow] ?? 0) > 0 ? missed / totalByDow[dow]! : 0, total: totalByDow[dow] ?? 0 }));
  const worst = rates.filter((row) => row.total >= 4).sort((a, b) => b.rate - a.rate)[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    ...base,
    statement: worst
      ? `You missed ${missedDates.size} of ${streaks.totalDays} days. ${dayNames[worst.dow]} is the weakest day, with ${Math.round(worst.rate * 100)}% of them missed across ${worst.total} occurrences. Your consistency overall is ${Math.round(streaks.consistency * 100)}%.`
      : `You missed ${missedDates.size} of ${streaks.totalDays} days, but no single day of the week stands out.`,
    evidence: [{ description: `${missedDates.size} missed days across ${streaks.totalDays}`, sampleSize: streaks.totalDays, metricIds: [metricId] }],
    caveats: ["Day-of-week patterns often reflect a fixed commitment rather than motivation."],
  };
}

function answerPrecedingBehaviours(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const metricId = parse.outcomeMetricId ?? "study.accuracy";
  const definition = context.registry.get(metricId);
  if (!definition) return decline(base, "I do not track a metric matching that question.");

  const series = dailySeries(context.events, definition, { fillGaps: false });
  const observed = series.values.filter(Number.isFinite);
  if (observed.length < 25) {
    return decline(base, `I have ${observed.length} days of ${definition.name.toLowerCase()} and need at least 25 to pick out your strongest days.`);
  }

  const threshold = [...observed].sort((a, b) => b - a)[Math.floor(observed.length * 0.2)]!;
  const strongDates = new Set(series.dates.filter((_, i) => (series.values[i] ?? NaN) >= threshold));

  // Which sources were active on the day before a strong day, versus otherwise?
  const bySource = new Map<string, { strong: number; other: number }>();
  const dateIndex = new Map(series.dates.map((date, i) => [date, i]));
  for (const event of context.events) {
    const index = dateIndex.get(event.localDate);
    if (index === undefined) continue;
    const nextDate = series.dates[index + 1];
    if (!nextDate) continue;
    const bucket = bySource.get(String(event.source)) ?? { strong: 0, other: 0 };
    if (strongDates.has(nextDate)) bucket.strong += 1;
    else bucket.other += 1;
    bySource.set(String(event.source), bucket);
  }

  const leaders = [...bySource.entries()]
    .filter(([, counts]) => counts.strong + counts.other >= 20)
    .map(([source, counts]) => ({ source, share: counts.strong / (counts.strong + counts.other), n: counts.strong + counts.other }))
    .sort((a, b) => b.share - a.share);

  if (leaders.length === 0) return decline(base, "I do not have enough activity from other sources on the days before your strongest days.");

  const top = leaders[0]!;
  return {
    ...base,
    statement: `Your strongest ${definition.name.toLowerCase()} days are the top 20% (at or above ${formatValue(threshold, definition.format)}). Activity from ${top.source} on the preceding day is the most over-represented signal, appearing before ${Math.round(top.share * 100)}% of them across ${top.n} events. This is a description of what tends to co-occur, not a mechanism.`,
    evidence: leaders.map((row) => ({ description: `${row.source}: ${row.n} events on preceding days`, sampleSize: row.n, metricIds: [metricId] })),
    caveats: [
      "Days when you do more of everything will show up here regardless of any real effect.",
      "Nothing about this comparison was controlled — it is a starting point for a question, not an answer.",
    ],
  };
}

function answerWhatChanged(context: AskContext, base: Base): Answer {
  if (context.weeklyBriefHeadline) {
    return { ...base, statement: context.weeklyBriefHeadline, evidence: [], caveats: [] };
  }
  return decline(base, "I have not generated a weekly brief yet, so I cannot tell you what changed.");
}

function answerWhatToTest(context: AskContext, base: Base): Answer {
  const testable = (context.recommendations ?? []).filter((recommendation) =>
    recommendation.nextStep.toLowerCase().includes("experiment"),
  );
  if (testable.length === 0) {
    const open = (context.hypotheses ?? []).filter((hypothesis) => hypothesis.status === "proposed");
    if (open.length === 0) {
      return decline(base, "Nothing in your data is yet strong enough to be worth a two-week experiment. Keep logging and I will flag it when something is.");
    }
    return {
      ...base,
      statement: `You have ${open.length} hypothesis(es) waiting to be tested. The first is: ${open[0]!.statement}`,
      caveats: [],
      evidence: [],
    };
  }

  const top = testable[0]!;
  return {
    ...base,
    // The next step is part of the answer: "what should I test next" is a
    // request for an instruction, not for a description.
    statement: `${top.statement} ${top.rationale} ${top.nextStep}`,
    evidence: top.evidence.map((reference) => ({
      description: reference.description,
      sampleSize: reference.eventCount,
      metricIds: reference.metricIds,
    })),
    caveats: top.caveats,
  };
}

function answerMetricSummary(context: AskContext, parse: ParsedQuestion, base: Base): Answer {
  const metricId = parse.outcomeMetricId;
  const definition = metricId ? context.registry.get(metricId) : undefined;
  if (!definition) return decline(base, "I could not tell which metric you meant.");

  const series = dailySeries(context.events, definition, { fillGaps: false });
  const values = series.values.filter(Number.isFinite);
  if (values.length < 5) return decline(base, `I only have ${values.length} days of ${definition.name.toLowerCase()}.`);

  const stats = summarise(values);
  const trend = analyseTrend(series);
  const trendText = trend.insufficient
    ? "There is not enough history to say whether it is trending."
    : trend.direction === "flat"
      ? "It is broadly flat over the period."
      : `It is ${trend.direction} by about ${formatValue(Math.abs(trend.slopePerWeek), definition.format)} per week.`;

  return {
    ...base,
    statement: `Your ${definition.name.toLowerCase()} averages ${formatValue(stats.mean, definition.format)} across ${values.length} days (median ${formatValue(stats.median, definition.format)}, range ${formatValue(stats.min, definition.format)} to ${formatValue(stats.max, definition.format)}). ${trendText}`,
    evidence: [{ description: `${values.length} days of data`, sampleSize: values.length, metricIds: [definition.id] }],
    caveats: trend.insufficient ? [trend.insufficient] : [],
  };
}

function formatValue(value: number, format?: string): string {
  if (!Number.isFinite(value)) return "n/a";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "duration-minutes") return `${Math.round(value)} min`;
  return String(round(value, 2));
}
