import Link from "next/link";
import { evaluateGold, sweepThreshold, bestThreshold } from "@/lib/benchmark";
import { goldStats, LABELLING_GUIDELINES } from "@/lib/benchmarkGold";
import { DEFAULT_THRESHOLD } from "@/lib/clustering";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clustering benchmark — World News Globe" };

const n2 = (n: number) => n.toFixed(2);

function SliceTable({ title, rows }: { title: string; rows: { slice: string; precision: number; recall: number; f1: number; bcubedF1: number; articles: number; events: number }[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-1.5 overflow-x-auto rounded-xl border border-rule bg-panel">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-muted">
              <th className="px-3 py-2">Slice</th>
              <th className="px-2 py-2">P</th>
              <th className="px-2 py-2">R</th>
              <th className="px-2 py-2">F1</th>
              <th className="px-2 py-2">B³ F1</th>
              <th className="px-2 py-2">Articles</th>
              <th className="px-3 py-2">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slice} className="border-b border-rule/60">
                <td className="px-3 py-2 font-medium">{r.slice}</td>
                <td className="px-2 py-2">{n2(r.precision)}</td>
                <td className="px-2 py-2">{n2(r.recall)}</td>
                <td className="px-2 py-2">{n2(r.f1)}</td>
                <td className="px-2 py-2">{n2(r.bcubedF1)}</td>
                <td className="px-2 py-2 text-muted">{r.articles}</td>
                <td className="px-3 py-2 text-muted">{r.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const report = evaluateGold();
  const stats = goldStats();
  const sweep = sweepThreshold(0.3, 0.6, 0.05);
  const best = bestThreshold(sweep);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Back to globe
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Clustering benchmark</h1>
      <p className="mt-1 text-sm text-muted">
        Measured against {stats.events} hand-labelled events plus {stats.singletons} labelled singletons —{" "}
        {stats.articles} articles across {stats.topics} topics and {stats.regions} regions. Deterministic, no
        model calls. Threshold {DEFAULT_THRESHOLD}.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Precision", report.overall.precision],
          ["Recall", report.overall.recall],
          ["F1", report.overall.f1],
          ["B³ F1", report.overall.bcubed.f1],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-rule bg-panel p-3 text-center">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-xl font-semibold">{n2(Number(value))}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{report.overall.note}</p>

      <SliceTable title="By topic" rows={report.byTopic} />
      <SliceTable title="By region" rows={report.byRegion} />
      <SliceTable title="By difficulty" rows={report.byDifficulty} />

      {(report.worstSplits.length > 0 || report.worstMerges.length > 0) && (
        <div className="mt-5 rounded-xl border border-rule bg-panel p-4">
          <h3 className="text-sm font-semibold">Where it still fails</h3>
          {report.worstSplits.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Events split across clusters
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {report.worstSplits.map((s) => (
                  <li key={s.event}>
                    {s.event} — {s.pieces} pieces ({s.topic} / {s.region})
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.worstMerges.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Distinct events fused together
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {report.worstMerges.map((m) => (
                  <li key={m.cluster}>
                    {m.cluster} — {m.events.length} events, {m.size} articles
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Threshold sweep</h3>
        <p className="mt-0.5 text-xs text-muted">
          Published to show the shape, not to pick a peak — a plateau means the signal is doing the work, a
          spike would mean the threshold is. Best by F1 + B³ F1: {best.threshold.toFixed(2)}.
        </p>
        <div className="mt-1.5 overflow-x-auto rounded-xl border border-rule bg-panel">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="px-3 py-2">Threshold</th>
                <th className="px-2 py-2">P</th>
                <th className="px-2 py-2">R</th>
                <th className="px-2 py-2">F1</th>
                <th className="px-2 py-2">B³ F1</th>
                <th className="px-3 py-2">Clusters</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map((r) => (
                <tr key={r.threshold} className={`border-b border-rule/60 ${r.threshold === best.threshold ? "bg-accent/5" : ""}`}>
                  <td className="px-3 py-2 font-medium">{r.threshold.toFixed(2)}</td>
                  <td className="px-2 py-2">{n2(r.precision)}</td>
                  <td className="px-2 py-2">{n2(r.recall)}</td>
                  <td className="px-2 py-2">{n2(r.f1)}</td>
                  <td className="px-2 py-2">{n2(r.bcubedF1)}</td>
                  <td className="px-3 py-2 text-muted">{r.clusters}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-rule bg-panel-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Method</p>
        <p className="mt-1 text-xs text-muted">
          Scoring combines IDF-weighted wording, canonical entities (so &ldquo;Kiew&rdquo; matches
          &ldquo;Kyiv&rdquo; and &ldquo;BCE&rdquo; matches &ldquo;ECB&rdquo;), reported figures, geography and
          time. Candidates are blocked through an inverted index and agglomerated with an average-linkage
          guard, so per-article cost stays roughly flat as the corpus grows. Two metric families are reported
          because they disagree usefully: pairwise F1 is dominated by large clusters, B-cubed weights every
          article equally.
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Labelling rules</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
          {LABELLING_GUIDELINES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">
          A separate seeded corpus of ~3,000 programmatically labelled articles is used for scale testing and
          is reported separately in <code className="rounded bg-panel px-1">npm run benchmark</code> — synthetic
          labels prove scaling behaviour, not editorial agreement.
        </p>
      </div>
    </main>
  );
}
