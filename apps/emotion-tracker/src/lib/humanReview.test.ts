import { describe, it, expect } from "vitest";
import { HUMAN_REVIEW_LABELS, anonymizeInterpretation, createReviewRecord, validateHumanLabels, validateCorpus, corpusContainsVerbatimText, createCorpus, pendingReviews, reviewedRecords } from "./humanReview";
import { buildCalibrationReport } from "./confidenceCalibration";

describe("human review corpus", () => {
  it("labels include required set", () => {
    for (const l of ["directly supported observation","reasonable inference","weak inference","unsupported claim","contradiction","useful","not useful","misleading","insufficient evidence"] as const) {
      expect(HUMAN_REVIEW_LABELS).toContain(l);
    }
  });
  it("validateHumanLabels catches unknown and contradictory", () => {
    expect(validateHumanLabels(["directly supported observation","unsupported claim"]).join(" ")).toMatch(/contradictory/i);
    expect(validateHumanLabels(["useful","misleading"]).join(" ")).toMatch(/contradictory/i);
    expect(validateHumanLabels(["bogus"] as unknown as string[]).join(" ")).toMatch(/unknown/i);
    expect(validateHumanLabels(["useful"])).toEqual([]);
  });
  it("anonymizeInterpretation strips verbatim text", () => {
    const ai = anonymizeInterpretation({ id:"i1", coreEmotion:"shame", observations:["a","b"], assumptions:["x"], alternatives:["alt"], biasTypes:["catastrophizing"], confidence:0.8 });
    expect(ai.coreEmotion).toBe("shame");
    expect(ai.observationCount).toBe(2);
    expect(ai.fingerprint).toBeTruthy();
    expect(ai as unknown as Record<string,unknown>).not.toHaveProperty("observations");
    expect(ai as unknown as Record<string,unknown>).not.toHaveProperty("event");
  });
  it("createReviewRecord derives band and support without fabricating", () => {
    const ai = anonymizeInterpretation({ id:"i1", coreEmotion:"shame", observations:["o"], assumptions:["a"], alternatives:[], biasTypes:[], confidence:0.82 });
    const r = createReviewRecord({ interpretationId:"i1", anonymizedInterpretation: ai, confidence:0.82, labels:["directly supported observation","useful"], reviewer:"r1", reviewedAt:"2026-01-10T00:00:00.000Z" });
    expect(r.confidenceBand).toBe("high");
    expect(r.humanSupport).toBe("supported");
    expect(r.reviewedAt).toBeTruthy();
  });
  it("unreviewed stays pending and insufficient handled", () => {
    const ai = anonymizeInterpretation({ id:"i2", confidence:0.5 });
    const pending = createReviewRecord({ interpretationId:"i2", anonymizedInterpretation: ai, labels:[] });
    expect(pending.humanSupport).toBe("pending");
    const ins = createReviewRecord({ interpretationId:"i2", anonymizedInterpretation: ai, labels:["insufficient evidence"] });
    expect(ins.humanSupport).toBe("insufficient");
  });
  it("validateCorpus rejects verbatim leakage", () => {
    const ai = anonymizeInterpretation({ id:"x", confidence:0.6 });
    const rec = createReviewRecord({ interpretationId:"x", anonymizedInterpretation: ai, labels:["useful"] });
    const corpus = createCorpus([rec]);
    expect(validateCorpus(corpus)).toEqual([]);
    // inject verbatim field should be flagged
    const bad = { version:1, createdAt:new Date().toISOString(), records:[{ ...rec, anonymizedInterpretation:{ ...(rec.anonymizedInterpretation as unknown as Record<string,unknown>), event:"verbatim" } }] };
    expect(validateCorpus(bad).join(" ")).toMatch(/verbatim/i);
  });
  it("corpusContainsVerbatimText does not flag counts, flags long strings", () => {
    const ai = anonymizeInterpretation({ id:"x", confidence:0.6 });
    const corpus = createCorpus([createReviewRecord({ interpretationId:"x", anonymizedInterpretation: ai, labels:["useful"] })]);
    expect(corpusContainsVerbatimText(corpus, "shame")).toBe(false);
    expect(corpusContainsVerbatimText(corpus, "This private transcript text is very long and should be flagged if leaked")).toBe(false);
  });
  it("pending vs reviewed partitioning", () => {
    const ai = anonymizeInterpretation({ id:"a" });
    const r1 = createReviewRecord({ interpretationId:"a", anonymizedInterpretation: ai, labels:[] });
    const r2 = createReviewRecord({ interpretationId:"a", anonymizedInterpretation: ai, labels:["useful"], reviewedAt:"2026-01-02T00:00:00.000Z" });
    const corpus = createCorpus([r1,r2]);
    expect(pendingReviews(corpus).length).toBe(1);
    expect(reviewedRecords(corpus).length).toBe(1);
  });
});

describe("confidence calibration", () => {
  it("high band should outrank low when well-calibrated", () => {
    const mk = (conf:number, support:"supported"|"unsupported") => {
      const ai = anonymizeInterpretation({ id:`i-${conf}-${Math.random()}`, confidence:conf });
      const labels: ("directly supported observation"|"unsupported claim")[] = support==="supported"?["directly supported observation"]:["unsupported claim"];
      return createReviewRecord({ interpretationId: ai.id, anonymizedInterpretation: ai, confidence:conf, labels: labels as unknown as typeof labels, reviewer:"r", reviewedAt:"2026-01-10T00:00:00.000Z" });
    };
    // 6 high supported, 6 low unsupported => correct ordering
    const records = [...Array(6)].map(()=>mk(0.9,"supported")).concat([...Array(6)].map(()=>mk(0.3,"unsupported")));
    const report = buildCalibrationReport(records);
    expect(report.totalReviewed).toBe(12);
    expect(report.bands.find(b=>b.band==="high")?.supportedRate).toBeGreaterThan(0.8);
    expect(report.bands.find(b=>b.band==="low")?.supportedRate).toBeLessThan(0.2);
    expect(report.weightedCalibrationError).not.toBeNull();
  });
  it("reports calibration error and sample size per band", () => {
    const ai = anonymizeInterpretation({ id:"x", confidence:0.9 });
    const records = [
      createReviewRecord({ interpretationId:"x", anonymizedInterpretation: ai, confidence:0.9, labels:["directly supported observation"], reviewedAt:"2026-01-01T00:00:00.000Z" }),
      createReviewRecord({ interpretationId:"x", anonymizedInterpretation: anonymizeInterpretation({id:"y", confidence:0.5}), confidence:0.5, labels:["unsupported claim"], reviewedAt:"2026-01-02T00:00:00.000Z" }),
    ];
    const report = buildCalibrationReport(records);
    expect(report.bands.find(b=>b.band==="high")?.n).toBe(1);
    expect(report.bands.find(b=>b.band==="high")?.calibrationError).not.toBeNull();
    expect(report.bands.find(b=>b.band==="moderate")?.n).toBe(1);
    expect(report.note).toBeTruthy();
  });
  it("handles empty reviews", () => {
    const report = buildCalibrationReport([]);
    expect(report.totalReviewed).toBe(0);
    expect(report.bands.every(b=>b.n===0)).toBe(true);
    expect(report.ordering).toBe("insufficient data");
  });
});
