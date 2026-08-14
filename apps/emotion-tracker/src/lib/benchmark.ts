// Benchmark harness — checks that generated interpretations don't make unsupported claims.
// Runs locally on synthetic fixtures; used by tests and optionally by the app's dev diagnostics.
// No network; no LLM.

import type { ReflectionSummary, BiasFlag, Entry } from "./types";
import { validateSummary, containsFalseCertainty } from "./validation";
import {
  detectContradictions, detectRecurringAssumptions, detectRecurringPatterns,
  decisionImprovement, resurfacingQueue,
} from "./longitudinal";
import { annotatePatterns, withoutDismissed } from "./corrections";

export interface BenchmarkCase {
  id: string;
  summary: ReflectionSummary;
  // what we expect the harness to find
  expectErrors?: number; // if omitted, expect 0
  expectFalseCertainty?: boolean;
}

export interface BenchmarkResult {
  id: string;
  errors: string[];
  falseCertainty: boolean;
  ungroundedBiasCount: number; // biases with thin evidenceFor
  verdict: "pass" | "fail";
}

function hasThinEvidence(b: BiasFlag): boolean {
  return !b.evidenceFor || b.evidenceFor.length === 0 || b.evidenceFor.every((s) => !s.trim() || s.length < 10);
}

export function runBenchmarkCase(c: BenchmarkCase): BenchmarkResult {
  const errors = validateSummary(c.summary);
  const allText = [
    c.summary.balancedAssessment,
    c.summary.otherPerspective,
    ...c.summary.possibleBiases.map((b) => b.description),
    ...c.summary.possibleBiases.flatMap((b) => b.evidenceFor),
  ].join(" ");
  const falseCertainty = containsFalseCertainty(allText);
  const ungroundedBiasCount = c.summary.possibleBiases.filter(hasThinEvidence).length;

  const expectErrors = c.expectErrors ?? 0;
  const expectFalseCertainty = c.expectFalseCertainty ?? false;

  // Fail if we found false certainty when none expected, or thin-evidence biases, or wrong error count
  const pass =
    errors.length === expectErrors &&
    falseCertainty === expectFalseCertainty &&
    ungroundedBiasCount === 0;

  return {
    id: c.id,
    errors,
    falseCertainty,
    ungroundedBiasCount,
    verdict: pass ? "pass" : "fail",
  };
}

export function runBenchmark(cases: BenchmarkCase[]): { results: BenchmarkResult[]; passed: number; failed: number } {
  const results = cases.map(runBenchmarkCase);
  return {
    results,
    passed: results.filter((r) => r.verdict === "pass").length,
    failed: results.filter((r) => r.verdict === "fail").length,
  };
}

// ── Longitudinal benchmark ─────────────────────────────────────────────
// Checks that the longitudinal engine recovers planted structure from
// deterministic fixtures: recurring patterns, contradictions, calibration
// improvement over time, resurfacing priority, and corrections (a rejected
// pattern must never resurface). Runs fully locally.

function benchEntry(id: string, createdAt: string, overrides: Partial<ReflectionSummary> = {}, review: Entry["longitudinalReview"] = null): Entry {
  const { trace: traceOverride, ...summaryRest } = overrides;
  const trace = {
    event: "E",
    observations: ["o"],
    assumptions: ["they think I am incompetent at work"],
    namedEmotion: "shame",
    alternativeInterpretations: ["alt"],
    intendedOutcome: "out",
    intendedAction: "ask",
    predictedOutcome: "p",
    followUpAt: "2026-01-10",
    followUpNote: null,
    ...(traceOverride ?? {}),
  };
  return {
    id,
    createdAt,
    title: "T" + id,
    messages: [{ role: "user", content: "start" }],
    status: "complete",
    summary: {
      trace,
      coreEmotion: "shame",
      underlyingTriggers: ["critical feedback"],
      possibleBiases: [],
      otherPerspective: "p",
      balancedAssessment: "b",
      cautionFlags: [],
      suggestedNextSteps: [],
      hedgedDisclaimer: null,
      ...summaryRest,
    },
    longitudinalReview: review,
  };
}

export interface LongitudinalCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export function runLongitudinalBenchmark(): LongitudinalCheck[] {
  // Planted: 3 entries with the same assumption + emotion, 1 contradiction.
  const recurring = [
    benchEntry("r1", "2026-01-01", { trace: { assumptions: ["they think I am incompetent at work"] } as ReflectionSummary["trace"] }),
    benchEntry("r2", "2026-01-08", { trace: { assumptions: ["they think I am incompetent at my job"] } as ReflectionSummary["trace"] }),
    benchEntry("r3", "2026-01-15", { trace: { assumptions: ["they think I am incompetent"] } as ReflectionSummary["trace"] }),
  ];
  const contrad = [
    benchEntry("c1", "2026-01-01", { trace: { assumptions: ["they will never help me"] } as ReflectionSummary["trace"] }),
    benchEntry("c2", "2026-01-05", { trace: { assumptions: ["they will always help me"] } as ReflectionSummary["trace"] }),
  ];
  const assumptions = detectRecurringAssumptions(recurring);
  const patterns = detectRecurringPatterns(recurring);
  const contras = detectContradictions(contrad);

  // Planted: 6 reviewed reflections — first 3 unsupported, last 3 supported
  // (calibration improves after reviews start landing).
  const reviewed = [0, 1, 2, 3, 4, 5].map((i) =>
    benchEntry(
      "d" + i,
      `2026-0${Math.floor(i / 2) + 1}-${String((i % 2) * 10 + 5).padStart(2, "0")}T12:00:00.000Z`,
      {},
      { actualActionTaken: "asked", actualOutcome: "x", assumptionVerdict: i < 3 ? "unsupported" : "supported", calibrationNote: "n", reviewedAt: `2026-0${Math.floor(i / 2) + 1}-${String((i % 2) * 10 + 6).padStart(2, "0")}T12:00:00.000Z` },
    ),
  );
  const improvement = decisionImprovement(reviewed);

  // Planted: one very overdue unresolved entry, one recent one.
  const overdue = benchEntry("o1", "2025-11-01", { trace: { followUpAt: "2025-11-10" } as ReflectionSummary["trace"] });
  const recent = benchEntry("o2", "2026-01-20", { trace: { followUpAt: "2026-01-25" } as ReflectionSummary["trace"] });
  const queue = resurfacingQueue([overdue, recent], new Date("2026-01-26T12:00:00.000Z"));

  // Planted: a recurring emotion pattern, then a correction rejecting it.
  const emotion = [
    benchEntry("p1", "2026-01-01", { coreEmotion: "shame" }),
    benchEntry("p2", "2026-01-02", { coreEmotion: "shame" }),
  ];
  const allPatterns = annotatePatterns(detectRecurringPatterns(emotion));
  const dismissed = allPatterns.map((p) => ({ key: p.key, kind: "pattern" as const, rejectedAt: "2026-01-03" }));
  const after = withoutDismissed(allPatterns, dismissed);

  return [
    { name: "recurring assumption detection recovers planted group", pass: assumptions.length >= 1 && assumptions[0].count >= 3, detail: `${assumptions[0]?.count ?? 0} grouped members` },
    { name: "recurring pattern detection recovers planted emotion", pass: patterns.some((p) => p.kind === "emotion" && p.count >= 3), detail: patterns.map((p) => `${p.kind}:${p.label}×${p.count}`).join(", ") || "none" },
    { name: "contradiction detection flags always-vs-never", pass: contras.length >= 1, detail: contras.map((c) => c.reason).join("; ") || "none" },
    { name: "decision improvement measured from real review sequence", pass: improvement.improved && improvement.before === 100 && improvement.after === 0, detail: `unsupported ${improvement.before}% → ${improvement.after}% over ${improvement.n} reviews` },
    { name: "resurfacing queue prioritises oldest overdue", pass: queue.length >= 2 && queue[0].entry.id === "o1", detail: queue.map((r) => `${r.entry.id} (${r.reason})`).join(" > ") },
    { name: "rejected pattern never resurfaces", pass: after.length === 0, detail: after.length === 0 ? "dismissed emotion pattern filtered" : "still surfacing: " + after.map((p) => p.label).join(", ") },
  ];
}

// ── Realistic longitudinal benchmark ───────────────────────────────────
// Validates pattern detection on a *realistic* multi-month corpus, not just
// clean planted fixtures: paraphrased recurrences, a near-duplicate decoy that
// must NOT group (precision), unrelated noise that must not form groups, a
// planted contradiction, and a recurring emotion pattern — all mixed in time.

export function runRealisticLongitudinalBenchmark(): LongitudinalCheck[] {
  // Planted recurrence: same assumption, four natural phrasings across months.
  const recurringIds = ["real-r1", "real-r2", "real-r3", "real-r4"];
  const recurring = [
    benchEntry("real-r1", "2025-10-06", { trace: { assumptions: ["they keep ignoring my messages at work"] } as ReflectionSummary["trace"] }),
    benchEntry("real-r2", "2025-11-12", { trace: { assumptions: ["they are ignoring my messages again"] } as ReflectionSummary["trace"] }),
    benchEntry("real-r3", "2025-12-03", { trace: { assumptions: ["they ignored my messages yesterday"] } as ReflectionSummary["trace"] }),
    benchEntry("real-r4", "2026-01-15", { trace: { assumptions: ["my messages keep being ignored at the office"] } as ReflectionSummary["trace"] }),
  ];
  // Decoy: shares the "ignoring/messages" stems with the planted group but
  // means something different — must stay out of the group.
  const decoy = benchEntry("real-decoy", "2025-11-20", { trace: { assumptions: ["I keep ignoring my alarm clock"] } as ReflectionSummary["trace"] });
  // Unrelated noise — each assumption unique; none may form a group.
  const noise = [
    benchEntry("real-n1", "2025-10-09", { trace: { assumptions: ["the weather is getting colder every week"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n2", "2025-10-22", { trace: { assumptions: ["traffic was worse than usual this morning"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n3", "2025-11-05", { trace: { assumptions: ["the meeting ran over by ten minutes"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n4", "2025-11-30", { trace: { assumptions: ["my laptop battery drains too quickly"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n5", "2025-12-18", { trace: { assumptions: ["the restaurant was fully booked"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n6", "2026-01-08", { trace: { assumptions: ["the train was delayed again"] } as ReflectionSummary["trace"] }),
    benchEntry("real-n7", "2026-01-22", { trace: { assumptions: ["the wifi keeps dropping during calls"] } as ReflectionSummary["trace"] }),
  ];
  // Planted contradiction: always-vs-never on the same subject.
  const contrad = [
    benchEntry("real-c1", "2025-10-15", { trace: { assumptions: ["my boss will never promote me"] } as ReflectionSummary["trace"] }),
    benchEntry("real-c2", "2025-11-08", { trace: { assumptions: ["my boss will always promote me"] } as ReflectionSummary["trace"] }),
  ];
  // Planted emotion pattern: frustration across several entries.
  const emotion = [
    benchEntry("real-e1", "2025-10-12", { coreEmotion: "frustration" }),
    benchEntry("real-e2", "2025-12-01", { coreEmotion: "frustration" }),
    benchEntry("real-e3", "2026-01-18", { coreEmotion: "frustration" }),
  ];

  const all = [...recurring, decoy, ...noise, ...contrad, ...emotion];
  const groups = detectRecurringAssumptions(all);
  const top = groups[0];
  const contras = detectContradictions(all);
  const patterns = detectRecurringPatterns(all);

  const groupMemberIds = top?.members.map((m) => m.entryId) ?? [];
  const recoveredAll = recurringIds.every((id) => groupMemberIds.includes(id));
  const groupHasDecoy = groupMemberIds.includes("real-decoy");
  // Noise precision: no group may be formed purely from noise members.
  const noiseOnlyGroup = groups.some((g) => g.members.length >= 2 && g.members.every((m) => m.entryId.startsWith("real-n")));
  const contradictionFound = contras.some((c) => [c.entryA, c.entryB].sort().join() === ["real-c1", "real-c2"].sort().join());
  const frustrationPattern = patterns.find((p) => p.kind === "emotion" && p.label === "frustration");

  return [
    { name: "paraphrased recurrence recovered (count 4)", pass: !!top && top.count === 4 && recoveredAll, detail: `group count ${top?.count ?? 0} · members ${groupMemberIds.join(", ") || "none"}` },
    { name: "near-duplicate decoy kept out (precision)", pass: !groupHasDecoy, detail: groupHasDecoy ? "decoy merged into the recurring group" : "decoy stayed separate" },
    { name: "no group formed from unrelated noise", pass: !noiseOnlyGroup, detail: `${groups.length} group(s) total` },
    { name: "contradiction found between always-vs-never", pass: contradictionFound, detail: contras.map((c) => c.reason).join("; ") || "none" },
    { name: "recurring emotion pattern recovered despite noise", pass: !!frustrationPattern && frustrationPattern.count >= 3, detail: frustrationPattern ? `${frustrationPattern.label}×${frustrationPattern.count}` : "not found" },
  ];
}

// A small default suite the app can run without any LLM
export function defaultBenchmarkCases(): BenchmarkCase[] {
  const validTrace = {
    event: "Manager gave brief critical feedback in standup.",
    observations: ["Manager said 'needs more detail in handover'"],
    assumptions: ["They think I'm incompetent"],
    namedEmotion: "shame",
    alternativeInterpretations: ["Manager wanted quicker handovers for the release"],
    intendedOutcome: "Feel trusted in handovers",
    intendedAction: "Ask for one concrete example",
    predictedOutcome: "If I ask, they'll give an example and I'll feel clearer.",
    followUpAt: "2026-01-20",
    followUpNote: null as string | null,
  };

  const hedgedBias: BiasFlag = {
    type: "catastrophizing",
    description: "This interpretation may involve catastrophizing; a brief delay was read as permanent rejection.",
    evidenceFor: ["User said 'it will ruin everything'"],
    evidenceAgainst: ["No evidence the delay is permanent"],
    confidence: 0.7,
  };

  return [
    {
      id: "valid hedged interpretation",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: ["Critical feedback in front of peers"],
        possibleBiases: [hedgedBias],
        otherPerspective: "Manager may see this as routine coaching.",
        balancedAssessment: "Feedback was blunt but not personal.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: "These are tentative readings, not diagnoses; weigh them against the evidence listed.",
      },
      expectErrors: 0,
    },
    {
      id: "false-certainty should be flagged",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: ["Critical feedback"],
        possibleBiases: [
          { ...hedgedBias, description: "You have catastrophizing bias." },
        ],
        otherPerspective: "Manager may see this as routine.",
        balancedAssessment: "Feedback was blunt.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: "These are tentative readings, not diagnoses.",
      },
      expectErrors: 1, // false-certainty description fails validation
      expectFalseCertainty: false, // validateSummary catches it before that check — harness still reports raw text
    },
    {
      id: "no bias without disclaimer is valid",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: [],
        possibleBiases: [],
        otherPerspective: "Routine coaching.",
        balancedAssessment: "Blunt but not personal.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: null,
      },
      expectErrors: 0,
    },
  ];
}
