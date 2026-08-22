"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/types";
import type { Correction } from "@/lib/corrections";
import {
  buildCalibrationReport,
  calibrationSampleSizeWarning,
} from "@/lib/confidenceCalibration";
import {
  evidenceAttribution,
  interpretationQuality,
  HUMAN_REVIEW_CORPUS_VERSION,
  loadCorpus,
  reviewedRecords,
  saveCorpus,
  validateCorpus,
} from "@/lib/humanReview";
import type { HumanReviewRecord } from "@/lib/humanReview";
import {
  correctionPersistence,
  longitudinalValidation,
} from "@/lib/validationMetrics";
import { buildPatternEvidences } from "@/lib/patternEvidence";

// TrustPanel — one honest surface for every self-measurement Reflect makes.
// Everything here is descriptive and computed locally. Thin samples say so;
// nothing claims clinical or diagnostic validity.

function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warn" | "good" }) {
  const toneCls = tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

const pct = (v: number | null | undefined): string => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function TrustPanel({ entries, corrections }: { entries: Entry[]; corrections: Correction[] }) {
  const [corpusRecords, setCorpusRecords] = useState<HumanReviewRecord[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Corpus is storage-backed; read after mount to stay hydration-safe.
  useEffect(() => {
    const timer = window.setTimeout(() => setCorpusRecords(loadCorpus().records), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** Hand the anonymised corpus to an external reviewer — no verbatim text. */
  function exportCorpus(): void {
    const corpus = loadCorpus();
    if (corpus.records.length === 0) {
      alert("The review corpus is empty. Records appear here once interpretations are submitted for external review.");
      return;
    }
    const payload = JSON.stringify({ ...corpus, version: HUMAN_REVIEW_CORPUS_VERSION }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reflect-review-corpus-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Re-import the corpus after reviewers have labelled it, so precision,
   *  false-inference and calibration metrics can compute. */
  async function importReviewed(file: File): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      alert("That file is not valid JSON — nothing was imported.");
      return;
    }
    const errors = validateCorpus(parsed);
    if (errors.length > 0) {
      alert(`Import rejected — not a valid review corpus:\n${errors.slice(0, 4).join("\n")}`);
      return;
    }
    const incoming = (parsed as { records: HumanReviewRecord[] }).records;
    const current = loadCorpus();
    const byId = new Map(current.records.map((r) => [r.id, r]));
    let updated = 0;
    let added = 0;
    for (const record of incoming) {
      if (byId.has(record.id)) updated++;
      else added++;
      byId.set(record.id, record);
    }
    const saved = saveCorpus({
      version: HUMAN_REVIEW_CORPUS_VERSION,
      createdAt: current.createdAt || new Date().toISOString(),
      records: [...byId.values()],
    });
    if (!saved) {
      alert("Could not save the imported reviews locally — storage unavailable.");
      return;
    }
    setCorpusRecords(loadCorpus().records);
    alert(`Review corpus merged: ${added} new, ${updated} updated. Metrics below now include them.`);
  }

  const reviewed = reviewedRecords({ version: 2, createdAt: "", records: corpusRecords });
  const quality = interpretationQuality(reviewed);
  const attribution = evidenceAttribution(reviewed);
  const calibration = buildCalibrationReport(reviewed);
  const calibrationWarning = calibrationSampleSizeWarning(calibration);
  const persistence = correctionPersistence(entries, corrections);
  const validation = longitudinalValidation(entries, corrections);
  const evidences = buildPatternEvidences(entries);
  const staleCount = evidences.filter((e) => e.status === "expired").length;
  const thinCount = evidences.filter((e) => e.status === "insufficient").length;
  const contradictedCount = evidences.filter((e) => e.contradictoryInstances.length > 0).length;

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="trust-title" aria-describedby="trust-desc">
      <h3 id="trust-title" className="text-xs font-semibold uppercase tracking-wider text-muted">Trust &amp; self-validation</h3>
      <p id="trust-desc" className="mt-1 text-xs leading-relaxed text-muted">
        Descriptive measures of how well Reflect&apos;s interpretations hold up — on your data, on this device.
        These are usage metrics, not clinical evidence; independent human review is what turns them into validation.
      </p>

      {/* Independent review */}
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Independent review corpus</p>
        {quality.reviewed === 0 ? (
          <p className="mt-1.5 text-xs text-muted">
            No externally reviewed interpretations yet. Reviewer labels land here with precision,
            false-inference rate and confidence calibration once a corpus exists.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Precision (grounded)" value={pct(quality.strictPrecision)} hint={`${quality.reviewed} reviewed`} />
            <Stat label="False-inference rate" value={pct(quality.falseInferenceRate)} tone={quality.falseInferenceRate != null && quality.falseInferenceRate > 0.3 ? "warn" : "default"} />
            <Stat label="Evidence attribution" value={pct(attribution.rate)} hint={`${attribution.attributed}/${attribution.attributed + attribution.unattributed} traceable`} />
            <Stat
              label="Confident misreads"
              value={String(quality.harmfulConfidentMisreads.length)}
              hint={quality.harmfulConfidentRate != null ? `${pct(quality.harmfulConfidentRate)} of high-confidence` : undefined}
              tone={quality.harmfulConfidentMisreads.length > 0 ? "warn" : "good"}
            />
          </div>
        )}
        {quality.note && quality.reviewed > 0 && <p className="mt-2 text-[11px] text-muted">{quality.note}</p>}
        {/* Reviewer round-trip: anonymised corpus out, labelled records back in. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCorpus}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover"
          >
            Export corpus for review
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover"
          >
            Import reviewed labels
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importReviewed(file);
              event.target.value = "";
            }}
          />
          <span className="text-[11px] text-muted">Anonymised records only — no reflection text ever leaves with them.</span>
        </div>
      </div>

      {/* Calibration */}
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Confidence calibration</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Reviewed for calibration" value={String(calibration.totalReviewed)} />
          <Stat
            label="Ordering check"
            value={calibration.ordering}
            tone={calibration.ordering === "inverted" ? "warn" : calibration.ordering === "correct" ? "good" : "default"}
            hint={calibration.weightedCalibrationError != null ? `weighted error ${Math.round(calibration.weightedCalibrationError * 100)}%` : undefined}
          />
          <Stat label="Pattern contradiction rate" value={pct(validation.contradictionRate)} hint={`${contradictedCount} pattern${contradictedCount === 1 ? "" : "s"} carry contradictory evidence`} />
        </div>
        {calibrationWarning && <p className="mt-2 text-[11px] text-amber-700">{calibrationWarning}</p>}
      </div>

      {/* Longitudinal loop health */}
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Correction &amp; retirement loop</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Corrections that stuck"
            value={persistence.tracked ? pct(persistence.persistenceRate) : "—"}
            hint={persistence.tracked ? `${persistence.fullyStopped}/${persistence.tracked} permanently stopped` : "reject an interpretation to track this"}
          />
          <Stat label="Patterns stayed supported" value={validation.remainedSupported ? `${validation.remainedSupported}` : "—"} hint={validation.unreviewed ? `${validation.unreviewed} awaiting follow-up` : undefined} />
          <Stat label="Retired (rejected / stale)" value={`${validation.retiredByUser} / ${staleCount}`} hint={`${validation.active} active patterns`} />
          <Stat
            label="Insufficient-evidence flags"
            value={String(thinCount)}
            tone={thinCount > 0 ? "warn" : "default"}
            hint={thinCount > 0 ? "shown below as tentative, never settled" : "all shown patterns clear the floor"}
          />
        </div>
      </div>
    </section>
  );
}
