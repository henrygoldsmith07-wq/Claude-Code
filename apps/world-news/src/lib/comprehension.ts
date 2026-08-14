// Does the globe actually help people understand the news?
//
// The globe is the most expensive thing this product renders — WebGL, textures,
// a heavy dependency, and a hard floor on the devices that can run it. It is
// justified only if readers understand the news better with it than without.
// Nobody has measured that, so this module is the apparatus for measuring it:
// deterministic assignment, a comprehension instrument, and the statistics to
// read the result — including the honest answer "this sample cannot tell".
//
// The design commits to a falsifiable prediction before data collection, which
// is what stops the analysis becoming a search for a flattering slice.

export type Arm = "globe" | "list";

export const HYPOTHESIS =
  "Readers using the globe answer spatial-reasoning questions (where, how near, how widespread) " +
  "more accurately than readers using the list, with no loss on factual recall. " +
  "If the globe does not beat the list on spatial questions, it is not earning its cost.";

/** Decided before collection so the analysis cannot move it afterwards. */
export const PRIMARY_OUTCOME = "spatialAccuracy";
export const MINIMUM_DETECTABLE_EFFECT = 0.1; // 10 percentage points
export const ALPHA = 0.05;

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/** FNV-1a — stable across sessions and processes, unlike Math.random. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Assign a participant to an arm.
 *
 * Hashing the participant id means the same reader always lands in the same
 * arm — switching interfaces mid-study would contaminate both. The experiment
 * name is in the hash so a second experiment does not inherit the first one's
 * split.
 */
export function assignArm(participantId: string, experiment = "globe-comprehension-v1"): Arm {
  return hash32(`${experiment}:${participantId}`) % 2 === 0 ? "globe" : "list";
}

/** Devices that cannot run the globe must not be silently counted as globe. */
export function eligibleForGlobe(caps: { webgl: boolean; deviceMemoryGb?: number; reducedMotion?: boolean }): boolean {
  if (!caps.webgl) return false;
  if (caps.reducedMotion) return false;
  if (typeof caps.deviceMemoryGb === "number" && caps.deviceMemoryGb < 2) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Instrument
// ---------------------------------------------------------------------------

export type QuestionKind = "spatial" | "factual" | "sourcing" | "calibration";

export interface ComprehensionQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** Why this question is in the instrument — guards against post-hoc additions. */
  measures: string;
}

/**
 * The instrument.
 *
 * Deliberately balanced: if it were all spatial questions the globe would win
 * by construction, and if it were all factual recall the list would. The
 * calibration item is the most interesting one — a globe that makes people
 * *feel* more informed without being more accurate is a finding, not a success.
 */
export const INSTRUMENT: ComprehensionQuestion[] = [
  { id: "s1", kind: "spatial", prompt: "Which region had the most stories in the period you just read?", measures: "Reading distribution across space" },
  { id: "s2", kind: "spatial", prompt: "Name two countries involved in the same event.", measures: "Recognising multi-country events" },
  { id: "s3", kind: "spatial", prompt: "Were the two largest stories geographically near each other or far apart?", measures: "Relative spatial judgement" },
  { id: "s4", kind: "spatial", prompt: "Which continent had the fewest stories?", measures: "Noticing coverage absence" },
  { id: "f1", kind: "factual", prompt: "What was the main development in the top story?", measures: "Factual recall of the lead" },
  { id: "f2", kind: "factual", prompt: "Name one figure (a count, percentage or date) reported in any story.", measures: "Retention of specifics" },
  { id: "f3", kind: "factual", prompt: "Which story, if any, carried a correction?", measures: "Noticing corrections" },
  { id: "c1", kind: "sourcing", prompt: "For the top story, how many independent sources supported it?", measures: "Reading the corroboration signal" },
  { id: "c2", kind: "sourcing", prompt: "Was any part of the top story disputed between sources?", measures: "Noticing contested facts" },
  { id: "k1", kind: "calibration", prompt: "How confident are you that you could explain today's main event to someone else? (0-100)", measures: "Self-rated understanding, compared against actual accuracy" },
];

export interface Response {
  participantId: string;
  arm: Arm;
  questionId: string;
  correct: boolean;
  /** 0-100, only for calibration items. */
  confidence?: number;
  /** Milliseconds from question shown to answered. */
  timeMs?: number;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Normal CDF via Abramowitz & Stegun 7.1.26 — no dependency needed for this. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (1.330274429 * t ** 4 - 1.821255978 * t ** 3 + 1.781477937 * t ** 2 - 0.356563782 * t + 0.319381530);
  return z > 0 ? 1 - p : p;
}

export interface ProportionTest {
  globeRate: number;
  listRate: number;
  difference: number;
  z: number;
  pValue: number;
  /** 95% CI on the difference. */
  ci: [number, number];
  significant: boolean;
  /** Plain-language reading, including "not enough data". */
  interpretation: string;
}

/**
 * Two-proportion z-test on accuracy between arms.
 *
 * The underpowered case is handled explicitly rather than being reported as a
 * null result: "no significant difference" from 40 participants means the study
 * could not see a difference, which is not the same as there not being one, and
 * conflating those is how an expensive feature survives on a technicality.
 */
export function compareProportions(
  globeCorrect: number, globeTotal: number,
  listCorrect: number, listTotal: number,
): ProportionTest {
  if (globeTotal === 0 || listTotal === 0) {
    return {
      globeRate: 0, listRate: 0, difference: 0, z: 0, pValue: 1, ci: [0, 0], significant: false,
      interpretation: "No responses in one or both arms — nothing to compare.",
    };
  }
  const p1 = globeCorrect / globeTotal;
  const p2 = listCorrect / listTotal;
  const pooled = (globeCorrect + listCorrect) / (globeTotal + listTotal);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / globeTotal + 1 / listTotal));
  const z = se === 0 ? 0 : (p1 - p2) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const seDiff = Math.sqrt((p1 * (1 - p1)) / globeTotal + (p2 * (1 - p2)) / listTotal);
  const margin = 1.96 * seDiff;
  const diff = p1 - p2;
  const significant = pValue < ALPHA;

  const requiredPerArm = requiredSampleSize(MINIMUM_DETECTABLE_EFFECT, Math.max(0.05, Math.min(0.95, pooled)));
  const underpowered = globeTotal < requiredPerArm || listTotal < requiredPerArm;

  let interpretation: string;
  if (significant) {
    interpretation = diff > 0
      ? `Globe readers scored ${Math.round(diff * 100)} points higher (p=${pValue.toFixed(3)}).`
      : `List readers scored ${Math.round(-diff * 100)} points higher (p=${pValue.toFixed(3)}).`;
  } else if (underpowered) {
    interpretation =
      `No difference detected, but this sample cannot detect one: ${requiredPerArm} responses per arm are ` +
      `needed for a ${Math.round(MINIMUM_DETECTABLE_EFFECT * 100)}-point effect and there are ` +
      `${Math.min(globeTotal, listTotal)}. Treat as inconclusive, not as evidence of no effect.`;
  } else {
    interpretation =
      `No difference beyond noise (p=${pValue.toFixed(3)}), and the sample is large enough to have found ` +
      `a ${Math.round(MINIMUM_DETECTABLE_EFFECT * 100)}-point effect. The globe is not improving this outcome.`;
  }

  return {
    globeRate: Math.round(p1 * 1000) / 1000,
    listRate: Math.round(p2 * 1000) / 1000,
    difference: Math.round(diff * 1000) / 1000,
    z: Math.round(z * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    ci: [Math.round((diff - margin) * 1000) / 1000, Math.round((diff + margin) * 1000) / 1000],
    significant,
    interpretation,
  };
}

/** Per-arm n for a given effect size at 80% power, alpha 0.05. */
export function requiredSampleSize(effect: number, baseRate = 0.5): number {
  const zAlpha = 1.96, zBeta = 0.84;
  const p = baseRate;
  const variance = 2 * p * (1 - p);
  return Math.ceil((variance * (zAlpha + zBeta) ** 2) / effect ** 2);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface StudyResult {
  participants: { globe: number; list: number };
  byKind: Record<QuestionKind, ProportionTest>;
  primary: ProportionTest;
  /** Mean self-rated confidence vs actual accuracy, per arm. */
  calibration: { arm: Arm; meanConfidence: number; actualAccuracy: number; gap: number }[];
  medianTimeMs: { globe: number; list: number };
  verdict: string;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Analyse a completed study.
 *
 * The verdict follows the pre-registered rule and nothing else: the globe has
 * to win the primary outcome, and not lose factual recall, to be justified.
 * A calibration gap — feeling better informed without being better informed —
 * is reported as a harm even when the primary outcome is positive, because
 * that is the outcome a pretty interface produces most easily.
 */
export function analyseStudy(responses: Response[]): StudyResult {
  const kindOf = new Map(INSTRUMENT.map((q) => [q.id, q.kind] as const));
  const scored = responses.filter((r) => kindOf.get(r.questionId) !== "calibration");

  const testFor = (predicate: (r: Response) => boolean): ProportionTest => {
    const g = scored.filter((r) => r.arm === "globe" && predicate(r));
    const l = scored.filter((r) => r.arm === "list" && predicate(r));
    return compareProportions(
      g.filter((r) => r.correct).length, g.length,
      l.filter((r) => r.correct).length, l.length,
    );
  };

  const byKind = {
    spatial: testFor((r) => kindOf.get(r.questionId) === "spatial"),
    factual: testFor((r) => kindOf.get(r.questionId) === "factual"),
    sourcing: testFor((r) => kindOf.get(r.questionId) === "sourcing"),
    calibration: testFor(() => false),
  } as Record<QuestionKind, ProportionTest>;

  const calibration = (["globe", "list"] as Arm[]).map((arm) => {
    const conf = responses.filter((r) => r.arm === arm && typeof r.confidence === "number").map((r) => r.confidence!);
    const acc = scored.filter((r) => r.arm === arm);
    const meanConfidence = conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : 0;
    const actualAccuracy = acc.length ? Math.round((acc.filter((r) => r.correct).length / acc.length) * 100) : 0;
    return { arm, meanConfidence, actualAccuracy, gap: meanConfidence - actualAccuracy };
  });

  const participants = {
    globe: new Set(responses.filter((r) => r.arm === "globe").map((r) => r.participantId)).size,
    list: new Set(responses.filter((r) => r.arm === "list").map((r) => r.participantId)).size,
  };

  const primary = byKind.spatial;
  const factualLoss = byKind.factual.significant && byKind.factual.difference < 0;
  const globeGap = calibration.find((c) => c.arm === "globe")?.gap ?? 0;
  const listGap = calibration.find((c) => c.arm === "list")?.gap ?? 0;

  let verdict: string;
  if (!primary.significant) {
    verdict = `Inconclusive or negative on the pre-registered primary outcome. ${primary.interpretation}`;
  } else if (primary.difference <= 0) {
    verdict = `The globe performs worse on spatial comprehension. ${primary.interpretation}`;
  } else if (factualLoss) {
    verdict = `The globe helps spatial comprehension but costs factual recall — a trade, not a win. ${byKind.factual.interpretation}`;
  } else if (globeGap - listGap > 15) {
    verdict =
      `The globe improves spatial comprehension, but globe readers overrate their own understanding by ` +
      `${globeGap - listGap} points more than list readers. Confidence without accuracy is a harm worth fixing before shipping wider.`;
  } else {
    verdict = `The globe earns its cost on the pre-registered outcome. ${primary.interpretation}`;
  }

  return {
    participants,
    byKind,
    primary,
    calibration,
    medianTimeMs: {
      globe: median(responses.filter((r) => r.arm === "globe" && r.timeMs).map((r) => r.timeMs!)),
      list: median(responses.filter((r) => r.arm === "list" && r.timeMs).map((r) => r.timeMs!)),
    },
    verdict,
  };
}

export const STUDY_METHODOLOGY =
  `Participants are assigned by a hash of their id, so the arm is stable across sessions. The primary ` +
  `outcome (${PRIMARY_OUTCOME}) and the ${Math.round(MINIMUM_DETECTABLE_EFFECT * 100)}-point minimum ` +
  `detectable effect are fixed before collection. Underpowered results are reported as inconclusive ` +
  `rather than as "no difference". Readers whose devices cannot run the globe are excluded from ` +
  `assignment rather than counted in the globe arm.`;
