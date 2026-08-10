"use client";
import { relationsFor } from "@/lib/geopolitics";

export default function GeopoliticsPanel({ code }: { code: string }) {
  const rels = relationsFor(code);
  if (rels.length === 0) return null;
  const badge: Record<string,string> = { ally: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", trade: "bg-sky-500/15 text-sky-300 border-sky-500/30", tension: "bg-orange-500/15 text-orange-300 border-orange-500/30", membership: "bg-violet-500/15 text-violet-300 border-violet-500/30" };
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Geopolitical context</h2>
      <ul className="mt-3 space-y-2">
        {rels.map(r=> (
          <li key={r.code} className="flex items-center gap-2 text-sm">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge[r.kind] ?? "border-rule bg-panel-soft text-muted"}`}>{r.kind}</span>
            <span className="font-medium">{r.label} ({r.code})</span>
            <span className="text-muted">— {r.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">Static context map — not an editorial judgment. See related stories below for current developments.</p>
    </section>
  );
}
