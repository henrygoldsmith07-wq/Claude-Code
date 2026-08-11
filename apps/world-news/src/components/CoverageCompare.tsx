"use client";
import type { CoverageMatrix } from "@/lib/coverageMatrix";

export default function CoverageCompare({ matrix }: { matrix: CoverageMatrix }) {
  if (matrix.size === 0) return null;
  const countries = [...matrix.keys()].slice(0, 8);
  const pubs = Array.from(new Set([...matrix.values()].flatMap(m=> [...m.keys()]))).slice(0, 8);
  return (
    <div className="overflow-auto rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Coverage across countries × publications</p>
      <table className="mt-3 w-full min-w-[420px] border-collapse text-xs">
        <thead><tr><th className="border-b border-rule px-2 py-1 text-left">Country \ Publisher</th>{pubs.map(p=> <th key={p} className="border-b border-rule px-2 py-1 text-left">{p}</th>)}</tr></thead>
        <tbody>
          {countries.map(cc=> (
            <tr key={cc}>
              <th className="border-b border-rule/60 px-2 py-1 text-left font-medium">{cc}</th>
              {pubs.map(pub=> {
                const cell = matrix.get(cc)?.get(pub);
                return <td key={pub} className="border-b border-rule/60 px-2 py-1 text-muted">{cell ? `${cell.count}` : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">Rows = source country, columns = publisher domain. Gaps highlight under-covered beats — add a region/topic to My Feed to track them.</p>
    </div>
  );
}
