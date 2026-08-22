// humanReview.ts — anonymised external review corpus infrastructure.
// No human review is fabricated; this is storage + validation + anonymisation
// so an external reviewer can label system interpretations without seeing PII.
//
// v2 label taxonomy (independent-reviewer vocabulary):
//   supported fact / reasonable observation / plausible hypothesis /
//   weak inference / unsupported interpretation / misleading interpretation.
// v1 labels remain valid so existing corpora stay readable.

export const HUMAN_REVIEW_LABELS = [
  // v2
  "supported fact",
  "reasonable observation",
  "plausible hypothesis",
  "weak inference", // shared with v1
  "unsupported interpretation",
  "misleading interpretation",
  // v1 (kept valid for backwards compatibility)
  "directly supported observation",
  "reasonable inference",
  "unsupported claim",
  "contradiction",
  "useful",
  "not useful",
  "misleading",
  "insufficient evidence",
] as const;

export type HumanReviewLabel = (typeof HUMAN_REVIEW_LABELS)[number];

/** Strictly grounded readings — the claim matches what the user recorded. */
export const FACTUAL_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "supported fact",
  "reasonable observation",
  "directly supported observation",
] as HumanReviewLabel[]);
/** Tentative but defensible inferences — hedged readings judged plausible. */
export const PLAUSIBLE_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "plausible hypothesis",
  "reasonable inference",
  "useful",
] as HumanReviewLabel[]);
/** Interpretations that outran the evidence. */
export const FALSE_INERENCE_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "weak inference",
  "unsupported interpretation",
  "unsupported claim",
  "contradiction",
] as HumanReviewLabel[]);
/** Interpretations that could mislead the user if acted upon. */
export const MISLEADING_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "misleading interpretation",
  "misleading",
] as HumanReviewLabel[]);

// Support tiers for calibration: maps review labels to "supported" boolean
export const SUPPORT_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  ...FACTUAL_LABELS,
  ...PLAUSIBLE_LABELS,
] as HumanReviewLabel[]);
export const UNSUPPORTED_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  ...FALSE_INERENCE_LABELS,
  ...MISLEADING_LABELS,
] as HumanReviewLabel[]);

export interface AnonymizedInterpretation {
  id: string; // stable interpretation id (never raw entry id)
  anonymizedAt: string; // ISO
  // Redacted fields: only structured interpretation, no verbatim user text
  coreEmotion: string | null;
  observationCount: number;
  assumptionCount: number;
  alternativeCount: number;
  biasTypes: string[]; // labels only, no verbatim description
  confidence: number | null; // 0..1
  // Optional excerpt fingerprint for dedupe without storing text
  fingerprint: string;
}

export interface HumanReviewRecord {
  id: string;
  interpretationId: string;
  anonymizedInterpretation: AnonymizedInterpretation;
  // Model's original confidence for this interpretation
  confidence: number | null;
  confidenceBand: "high" | "moderate" | "low" | "unscored";
  labels: HumanReviewLabel[];
  reviewer: string | null; // anonymised reviewer id, never PII
  reviewedAt: string | null; // ISO when human reviewed, null = pending
  notes: string | null; // optional reviewer notes, no PII
  // Human support derived from labels — not invented, computed
  humanSupport: "supported" | "unsupported" | "mixed" | "pending" | "insufficient";
}

export const HUMAN_REVIEW_CORPUS_KEY = "reflectHumanReviewCorpus";
export const HUMAN_REVIEW_CORPUS_VERSION = 2 as const;
/** Corpora written by earlier versions remain valid for reading. */
const SUPPORTED_CORPUS_VERSIONS = [1, 2] as const;

export interface HumanReviewCorpus {
  version: typeof HUMAN_REVIEW_CORPUS_VERSION;
  createdAt: string;
  records: HumanReviewRecord[];
}

function confidenceBand(confidence: number | null): HumanReviewRecord["confidenceBand"] {
  if (confidence == null || !Number.isFinite(confidence)) return "unscored";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.45) return "moderate";
  return "low";
}

function deriveSupport(labels: HumanReviewLabel[]): HumanReviewRecord["humanSupport"] {
  if (labels.length === 0) return "pending";
  if (labels.includes("insufficient evidence")) return "insufficient";
  const hasSupport = labels.some((l) => SUPPORT_LABELS.has(l));
  const hasUnsupport = labels.some((l) => UNSUPPORTED_LABELS.has(l));
  if (hasSupport && hasUnsupport) return "mixed";
  if (hasSupport) return "supported";
  if (hasUnsupport) return "unsupported";
  // weak inference / not useful etc. -> mixed/insufficient
  return "mixed";
}

export function isValidHumanLabel(label: string): label is HumanReviewLabel {
  return (HUMAN_REVIEW_LABELS as readonly string[]).includes(label);
}

export function validateHumanLabels(labels: string[]): string[] {
  const errors: string[] = [];
  for (const l of labels) if (!isValidHumanLabel(l)) errors.push(`unknown label: ${l}`);
  if (labels.includes("directly supported observation") && labels.includes("unsupported claim"))
    errors.push("contradictory labels: directly supported vs unsupported");
  if (labels.includes("useful") && labels.includes("misleading"))
    errors.push("contradictory labels: useful vs misleading");
  return errors;
}

function fingerprint(s: string): string {
  // simple non-crypto hash for dedupe — no PII, deterministic
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

export function anonymizeInterpretation(raw: {
  id: string;
  coreEmotion?: string | null;
  observations?: string[];
  assumptions?: string[];
  alternatives?: string[];
  biasTypes?: string[];
  confidence?: number | null;
}): AnonymizedInterpretation {
  const obs = raw.observations ?? [];
  const ass = raw.assumptions ?? [];
  const alt = raw.alternatives ?? [];
  const bias = raw.biasTypes ?? [];
  const conf = raw.confidence ?? null;
  const fpSrc = [raw.coreEmotion ?? "", String(obs.length), String(ass.length), String(alt.length), bias.join("|")].join(":");
  return {
    id: raw.id,
    anonymizedAt: new Date().toISOString(),
    coreEmotion: raw.coreEmotion ?? null,
    observationCount: obs.length,
    assumptionCount: ass.length,
    alternativeCount: alt.length,
    biasTypes: bias.slice(0, 8),
    confidence: conf != null && Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : null,
    fingerprint: fingerprint(fpSrc),
  };
}

export function createReviewRecord(params: {
  id?: string;
  interpretationId: string;
  anonymizedInterpretation: AnonymizedInterpretation;
  confidence?: number | null;
  labels?: HumanReviewLabel[];
  reviewer?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
}): HumanReviewRecord {
  const conf = params.confidence ?? params.anonymizedInterpretation.confidence ?? null;
  const labels = params.labels ?? [];
  const reviewedAt = params.reviewedAt ?? (labels.length ? new Date().toISOString() : null);
  return {
    id: params.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `hr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    interpretationId: params.interpretationId,
    anonymizedInterpretation: params.anonymizedInterpretation,
    confidence: conf,
    confidenceBand: confidenceBand(conf),
    labels,
    reviewer: params.reviewer ?? null,
    reviewedAt,
    notes: params.notes ?? null,
    humanSupport: deriveSupport(labels),
  };
}

export function createCorpus(records: HumanReviewRecord[] = []): HumanReviewCorpus {
  return { version: HUMAN_REVIEW_CORPUS_VERSION, createdAt: new Date().toISOString(), records: records.slice() };
}

export function validateCorpus(raw: unknown): string[] {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { errors.push("corpus must be an object"); return errors; }
  const r = raw as Record<string, unknown>;
  if (typeof r.version !== "number" || !(SUPPORTED_CORPUS_VERSIONS as readonly number[]).includes(r.version)) {
    errors.push(`version must be one of ${SUPPORTED_CORPUS_VERSIONS.join(", ")}`);
  }
  if (!Array.isArray(r.records)) errors.push("records must be an array");
  else {
    for (let i = 0; i < (r.records as unknown[]).length; i++) {
      const rec = (r.records as Record<string, unknown>[])[i];
      if (typeof rec?.id !== "string") errors.push(`record[${i}].id required`);
      if (typeof rec?.interpretationId !== "string") errors.push(`record[${i}].interpretationId required`);
      if (!Array.isArray(rec?.labels)) errors.push(`record[${i}].labels must be array`);
      else {
        const bad = (rec.labels as string[]).filter((l) => !isValidHumanLabel(l));
        if (bad.length) errors.push(`record[${i}] unknown labels: ${bad.join(", ")}`);
      }
      if (rec?.anonymizedInterpretation && typeof rec.anonymizedInterpretation === "object") {
        const ai = rec.anonymizedInterpretation as Record<string, unknown>;
        if (typeof ai.fingerprint !== "string") errors.push(`record[${i}].fingerprint required`);
        // must not contain verbatim text fields
        if ("event" in ai || "observations" in ai || "assumptions" in ai) errors.push(`record[${i}] anonymizedInterpretation must not contain verbatim text`);
      }
    }
  }
  return errors;
}

export function corpusContainsVerbatimText(corpus: HumanReviewCorpus, verbatim: string): boolean {
  if (!verbatim || verbatim.trim().length < 12) return false;
  const hay = JSON.stringify(corpus).toLowerCase();
  return hay.includes(verbatim.trim().toLowerCase());
}

// No synthetic generation: this helper only rehydrates records that already exist.
// To study calibration, reviewers must label externally; this code never invents labels.
export function pendingReviews(corpus: HumanReviewCorpus): HumanReviewRecord[] {
  return corpus.records.filter((r) => !r.reviewedAt || r.labels.length === 0);
}

export function reviewedRecords(corpus: HumanReviewCorpus): HumanReviewRecord[] {
  return corpus.records.filter((r) => Boolean(r.reviewedAt) && r.labels.length > 0);
}

// ── corpus persistence ─────────────────────────────────────────────────
// Local-only by design: the corpus never leaves the device unless the user
// exports it deliberately for external review.

export function emptyCorpus(): HumanReviewCorpus {
  return createCorpus([]);
}

/** Load the stored corpus. Corrupt or invalid data degrades to an empty
 *  corpus — a broken file must not crash the app. */
export function loadCorpus(): HumanReviewCorpus {
  if (typeof window === "undefined") return emptyCorpus();
  try {
    const raw = window.localStorage.getItem(HUMAN_REVIEW_CORPUS_KEY);
    if (!raw) return emptyCorpus();
    const parsed: unknown = JSON.parse(raw);
    if (validateCorpus(parsed).length > 0) return emptyCorpus();
    const r = parsed as Record<string, unknown>;
    const records = Array.isArray(r.records) ? (r.records as HumanReviewRecord[]) : [];
    // normalise version up so saves always write current
    return { version: HUMAN_REVIEW_CORPUS_VERSION, createdAt: String(r.createdAt ?? ""), records };
  } catch {
    return emptyCorpus();
  }
}

/** Persist the corpus. Returns false when storage is unavailable/quota hit. */
export function saveCorpus(corpus: HumanReviewCorpus): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      HUMAN_REVIEW_CORPUS_KEY,
      JSON.stringify({ ...corpus, version: HUMAN_REVIEW_CORPUS_VERSION }),
    );
    return true;
  } catch {
    console.warn("Could not save human-review corpus locally.");
    return false;
  }
}

/** Append or replace a record (by id) and persist. Returns success. */
export function upsertRecord(record: HumanReviewRecord): boolean {
  const corpus = loadCorpus();
  const idx = corpus.records.findIndex((r) => r.id === record.id);
  if (idx >= 0) corpus.records[idx] = record;
  else corpus.records.push(record);
  return saveCorpus(corpus);
}

// ── independent-review measurements ────────────────────────────────────
// All descriptive, computed from labels real reviewers produced — never
// invented here. Thin samples are flagged rather than over-claimed.

export interface HarmfulMisread {
  recordId: string;
  confidenceBand: HumanReviewRecord["confidenceBand"];
  labels: HumanReviewLabel[];
  reason: "high-confidence misleading" | "high-confidence unsupported";
}

export interface InterpretationQuality {
  reviewed: number;
  /** supported fact + reasonable observation / all reviewed */
  strictPrecision: number | null;
  /** (strictly grounded + plausible hypothesis) / all reviewed */
  acceptanceRate: number | null;
  /** unsupported or misleading interpretations / all reviewed */
  falseInferenceRate: number | null;
  /** high-confidence interpretations later judged misleading/unsupported */
  harmfulConfidentMisreads: HarmfulMisread[];
  harmfulConfidentRate: number | null; // of high-band reviewed
  note: string;
}

function hasAny(labels: HumanReviewLabel[], set: ReadonlySet<HumanReviewLabel>): boolean {
  return labels.some((l) => set.has(l));
}

export function interpretationQuality(records: HumanReviewRecord[]): InterpretationQuality {
  const reviewed = records.filter((r) => Boolean(r.reviewedAt) && r.labels.length > 0);
  const scored = reviewed.filter((r) => r.humanSupport !== "insufficient");
  const total = scored.length;

  const factual = scored.filter((r) => hasAny(r.labels, FACTUAL_LABELS));
  const plausible = scored.filter((r) => !hasAny(r.labels, FACTUAL_LABELS) && hasAny(r.labels, PLAUSIBLE_LABELS));
  const falseInferences = scored.filter((r) => hasAny(r.labels, FALSE_INERENCE_LABELS));
  const harmful = scored
    .filter((r) => r.confidenceBand === "high")
    .filter((r) => hasAny(r.labels, MISLEADING_LABELS) || (!hasAny(r.labels, SUPPORT_LABELS) && hasAny(r.labels, FALSE_INERENCE_LABELS)))
    .map((r) => ({
      recordId: r.id,
      confidenceBand: r.confidenceBand,
      labels: r.labels.slice(),
      reason: (hasAny(r.labels, MISLEADING_LABELS) ? "high-confidence misleading" : "high-confidence unsupported") as HarmfulMisread["reason"],
    }));
  const highBand = scored.filter((r) => r.confidenceBand === "high");

  const rate = (n: number) => (total ? n / total : null);
  let note: string;
  if (total === 0) note = "No reviewed interpretations yet — precision cannot be measured.";
  else if (total < 10) note = `Only ${total} reviewed — treat these rates as indicative, not measured.`;
  else note = `${factual.length} grounded · ${plausible.length} plausible · ${falseInferences.length} outran the evidence across ${total} reviews.${harmful.length ? ` ${harmful.length} confident misread${harmful.length === 1 ? "" : "s"} flagged for priority review.` : ""}`;

  return {
    reviewed: total,
    strictPrecision: rate(factual.length),
    acceptanceRate: rate(factual.length + plausible.length),
    falseInferenceRate: rate(falseInferences.length),
    harmfulConfidentMisreads: harmful,
    harmfulConfidentRate: highBand.length ? harmful.length / highBand.length : null,
    note,
  };
}

/** Share of reviewed interpretations traceable to at least one recorded user
 *  observation — measures whether claims cite user-provided evidence rather
 *  than floating free of it. */
export function evidenceAttribution(records: HumanReviewRecord[]): { rate: number | null; attributed: number; unattributed: number; note: string } {
  const reviewed = records.filter((r) => Boolean(r.reviewedAt) && r.labels.length > 0 && r.humanSupport !== "insufficient");
  const attributed = reviewed.filter((r) => r.anonymizedInterpretation.observationCount >= 1).length;
  const unattributed = reviewed.length - attributed;
  return {
    rate: reviewed.length ? attributed / reviewed.length : null,
    attributed,
    unattributed,
    note: reviewed.length
      ? `${attributed}/${reviewed.length} reviewed interpretations were traceable to at least one recorded observation.`
      : "No reviewed interpretations yet — attribution cannot be measured.",
  };
}
