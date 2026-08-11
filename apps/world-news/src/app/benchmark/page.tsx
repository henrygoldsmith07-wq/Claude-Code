import { evaluateBenchmark, SAMPLE_CASES } from "@/lib/benchmark";
import { EXTENDED_CASES } from "@/lib/benchmarkDataset";

export const dynamic = "force-dynamic";
export const metadata = { title: "Benchmark — World News Globe" };

export default function BenchmarkPage() {
  const cases = [...SAMPLE_CASES, ...EXTENDED_CASES];
  const results = cases.map(c=> evaluateBenchmark(c));
  const mp = results.reduce((s,r)=>s+r.precision,0)/results.length;
  const mr = results.reduce((s,r)=>s+r.recall,0)/results.length;
  const mf = results.reduce((s,r)=>s+r.f1,0)/results.length;
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <a href="/" className="text-sm text-accent hover:underline">← Back to globe</a>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Clustering benchmark</h1>
      <p className="mt-1 text-sm text-muted">Precision/recall/F1 under pairwise event identity. Deterministic, no LLM calls. Threshold 0.42.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-rule bg-panel p-3 text-center"><p className="text-xs text-muted">Macro precision</p><p className="text-xl font-semibold">{mp.toFixed(2)}</p></div>
        <div className="rounded-xl border border-rule bg-panel p-3 text-center"><p className="text-xs text-muted">Macro recall</p><p className="text-xl font-semibold">{mr.toFixed(2)}</p></div>
        <div className="rounded-xl border border-rule bg-panel p-3 text-center"><p className="text-xs text-muted">Macro F1</p><p className="text-xl font-semibold">{mf.toFixed(2)}</p></div>
      </div>
      <div className="mt-6 overflow-auto rounded-xl border border-rule bg-panel">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead><tr className="border-b border-rule text-left text-xs text-muted"><th className="px-3 py-2">Case</th><th className="px-2 py-2">P</th><th className="px-2 py-2">R</th><th className="px-2 py-2">F1</th><th className="px-3 py-2">Note</th></tr></thead>
          <tbody>{results.map(r=> <tr key={r.name} className="border-b border-rule/60"><td className="px-3 py-2 font-medium">{r.name}</td><td className="px-2 py-2">{r.precision.toFixed(2)}</td><td className="px-2 py-2">{r.recall.toFixed(2)}</td><td className="px-2 py-2">{r.f1.toFixed(2)}</td><td className="px-3 py-2 text-xs text-muted">{r.note}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Cases: {cases.length} (2 base + {EXTENDED_CASES.length} extended — syndicated, multi-country, regional, split/merge). Confidence & coverage of clusteringQuality are reported in tests. See <code className="rounded bg-panel-soft px-1">src/lib/benchmark.ts</code>.</p>
      <div className="mt-6 rounded-xl border border-rule bg-panel-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Method</p>
        <p className="mt-1 text-xs text-muted">Greedy agglomerative on title Jaccard + tag overlap + haversine + topic + publisher diversity; threshold 0.42. Evaluation is pairwise: pred vs true same-event pairs → P/R/F1. Syndicated dedup and event persistence are separate layers before/after clustering.</p>
      </div>
    </main>
  );
}
