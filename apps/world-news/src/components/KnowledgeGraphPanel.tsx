"use client";
import type { Graph } from "@/lib/knowledgeGraph";

function Chip({ label, w }: { label: string; w: number }) {
  return <span className="rounded-full border border-rule bg-panel-soft px-2 py-0.5 text-xs">{label} · {w}</span>;
}

export default function KnowledgeGraphPanel({ entity, country, event }: { entity?: Graph; country?: Graph; event?: Graph }) {
  if (!entity && !country && !event) return null;
  return (
    <div className="space-y-4 rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Knowledge graphs</p>
      {entity && entity.nodes.length>0 && (
        <div>
          <p className="text-xs font-medium text-muted">Entities &amp; themes</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{entity.nodes.slice(0,16).map(n=> <Chip key={n.id} label={n.label} w={n.weight} />)}</div>
          {entity.edges.length>0 && <p className="mt-2 text-[11px] text-muted">Links: {entity.edges.slice(0,5).map(e=> `${e.from} — ${e.to} (${e.weight})`).join(" · ")}</p>}
        </div>
      )}
      {country && country.nodes.length>0 && (
        <div>
          <p className="text-xs font-medium text-muted">Country co-coverage</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{country.nodes.map(n=> <Chip key={n.id} label={`${n.label} (${n.id})`} w={n.weight} />)}</div>
        </div>
      )}
      {event && event.nodes.length>0 && (
        <div>
          <p className="text-xs font-medium text-muted">Event relationships</p>
          <p className="mt-1 text-xs text-muted">{event.edges.length} related-event links (shared tags). {event.edges.slice(0,3).map(e=> `${e.from.slice(0,14)}↔${e.to.slice(0,14)}`).join(" · ") || "No strong links yet."}</p>
        </div>
      )}
    </div>
  );
}
