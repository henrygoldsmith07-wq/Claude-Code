// humanReview.ts — anonymised external review corpus infrastructure.
// No human review is fabricated; this is storage + validation + anonymisation
// so an external reviewer can label system interpretations without seeing PII.

export const HUMAN_REVIEW_LABELS = [
  "directly supported observation",
  "reasonable inference",
  "weak inference",
  "unsupported claim",
  "contradiction",
  "useful",
  "not useful",
  "misleading",
  "insufficient evidence",
] as const;

export type HumanReviewLabel = (typeof HUMAN_REVIEW_LABELS)[number];

// Support tiers for calibration: maps review labels to "supported" boolean
export const SUPPORT_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "directly supported observation",
  "reasonable inference",
  "useful",
] as HumanReviewLabel[]);
export const UNSUPPORTED_LABELS: ReadonlySet<HumanReviewLabel> = new Set([
  "unsupported claim",
  "contradiction",
  "misleading",
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
export const HUMAN_REVIEW_CORPUS_VERSION = 1 as const;

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
  if (r.version !== HUMAN_REVIEW_CORPUS_VERSION) errors.push(`version must be ${HUMAN_REVIEW_CORPUS_VERSION}`);
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
