// The benchmark *is* the regression guard: `npm run benchmark` runs this file
// and prints the tables, and `npm test` runs it alongside everything else so a
// clustering change that quietly loses accuracy fails CI instead of shipping.
//
// Floors are set below current measured performance, not at it — they exist to
// catch collapses, not to freeze the numbers. Tighten them when a real
// improvement lands.
import { describe, it, expect } from "vitest";
import { evaluateGold, evaluateScale, sweepThreshold, bestThreshold } from "./benchmark";
import { goldStats, LABELLING_GUIDELINES } from "./benchmarkGold";

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const num = (n: number) => n.toFixed(2);

function table(title: string, rows: { slice: string; precision: number; recall: number; f1: number; bcubedF1: number; articles: number; events: number }[]) {
  const lines = [`\n  ${title}`, `  ${pad("slice", 22)}${pad("P", 6)}${pad("R", 6)}${pad("F1", 6)}${pad("B³F1", 7)}${pad("arts", 6)}events`];
  for (const r of rows) {
    lines.push(`  ${pad(r.slice, 22)}${pad(num(r.precision), 6)}${pad(num(r.recall), 6)}${pad(num(r.f1), 6)}${pad(num(r.bcubedF1), 7)}${pad(r.articles, 6)}${r.events}`);
  }
  console.log(lines.join("\n"));
}

describe("clustering benchmark — human gold set", () => {
  const report = evaluateGold();

  it("prints the labelled-set report", () => {
    const s = goldStats();
    console.log(
      `\n  Human-labelled gold set: ${s.events} events + ${s.singletons} labelled singletons = ${s.articles} articles` +
      `\n  across ${s.topics} topics and ${s.regions} regions. Guidelines: ${LABELLING_GUIDELINES.length} rules.` +
      `\n  Overall @${report.threshold}: P=${num(report.overall.precision)} R=${num(report.overall.recall)} F1=${num(report.overall.f1)}` +
      ` | B³ P=${num(report.overall.bcubed.precision)} R=${num(report.overall.bcubed.recall)} F1=${num(report.overall.bcubed.f1)}` +
      `\n  ${report.overall.note}`,
    );
    table("By topic", report.byTopic);
    table("By region", report.byRegion);
    table("By difficulty", report.byDifficulty);
    if (report.worstSplits.length) {
      console.log(`\n  Split events (one event scattered across clusters):`);
      for (const s2 of report.worstSplits) console.log(`    ${pad(s2.event, 28)}${s2.pieces} pieces  ${s2.topic} / ${s2.region}`);
    }
    if (report.worstMerges.length) {
      console.log(`\n  Over-merged clusters (several events fused):`);
      for (const m of report.worstMerges) console.log(`    ${pad(m.cluster, 46)}${m.events.length} events, ${m.size} articles`);
    }
    expect(goldStats().articles).toBeGreaterThan(200);
  });

  it("holds precision and recall on the labelled set", () => {
    expect(report.overall.precision).toBeGreaterThanOrEqual(0.9);
    expect(report.overall.recall).toBeGreaterThanOrEqual(0.85);
    expect(report.overall.bcubed.f1).toBeGreaterThanOrEqual(0.92);
  });

  it("does not collapse on any topic or region slice", () => {
    for (const s of [...report.byTopic, ...report.byRegion]) {
      if (s.articles < 6) continue;
      expect.soft(s.bcubedF1, `slice ${s.slice}`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("keeps near-miss events apart", () => {
    const nearMiss = report.byDifficulty.find((d) => d.slice === "nearmiss");
    expect(nearMiss).toBeDefined();
    // Precision is the metric that catches "merged two similar events into one".
    expect(nearMiss!.precision).toBeGreaterThanOrEqual(0.9);
  });

  it("recovers cross-lingual events", () => {
    const cross = report.byDifficulty.find((d) => d.slice === "crosslingual");
    expect(cross).toBeDefined();
    expect(cross!.recall).toBeGreaterThanOrEqual(0.8);
  });
});

describe("clustering benchmark — threshold sweep", () => {
  it("has a plateau rather than a knife-edge optimum", () => {
    const rows = sweepThreshold(0.3, 0.6, 0.05);
    const best = bestThreshold(rows);
    console.log(`\n  Threshold sweep (gold set)`);
    console.log(`  ${pad("thr", 7)}${pad("P", 6)}${pad("R", 6)}${pad("F1", 6)}${pad("B³F1", 7)}clusters`);
    for (const r of rows) {
      console.log(`  ${pad(r.threshold.toFixed(2), 7)}${pad(num(r.precision), 6)}${pad(num(r.recall), 6)}${pad(num(r.f1), 6)}${pad(num(r.bcubedF1), 7)}${r.clusters}`);
    }
    console.log(`  best by F1+B³F1: ${best.threshold.toFixed(2)}`);
    // Within ±0.05 of the optimum, B-cubed F1 should not fall off a cliff.
    const near = rows.filter((r) => Math.abs(r.threshold - best.threshold) <= 0.05001);
    for (const r of near) expect.soft(r.bcubedF1, `threshold ${r.threshold}`).toBeGreaterThanOrEqual(best.bcubedF1 - 0.12);
  });
});

describe("clustering benchmark — scale", () => {
  it("holds accuracy and stays sub-quadratic at ~2,000 articles", async () => {
    const small = await evaluateScale(60, 7);
    const large = await evaluateScale(500, 7);
    console.log(
      `\n  Synthetic corpus (programmatically labelled — reported separately from the human set)` +
      `\n    ${pad(small.articles + " articles", 20)}P=${num(small.precision)} R=${num(small.recall)} F1=${num(small.f1)} B³F1=${num(small.bcubed.f1)}  ${small.elapsedMs}ms (${small.msPerArticle}ms/article)` +
      `\n    ${pad(large.articles + " articles", 20)}P=${num(large.precision)} R=${num(large.recall)} F1=${num(large.f1)} B³F1=${num(large.bcubed.f1)}  ${large.elapsedMs}ms (${large.msPerArticle}ms/article)`,
    );
    expect(large.articles).toBeGreaterThan(1500);
    expect(large.bcubed.f1).toBeGreaterThanOrEqual(0.7);
    // Blocking is the whole point: per-article cost must not grow with corpus
    // size the way all-pairs scoring would.
    expect(large.msPerArticle).toBeLessThan(small.msPerArticle * 6 + 1);
  }, 120_000);
});
