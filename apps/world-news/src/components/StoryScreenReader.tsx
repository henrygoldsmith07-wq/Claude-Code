"use client";
import type { StoryCluster } from "@/lib/storyModel";

/** Accessible, screen-reader-first story list (no globe dependency). */
export default function StoryScreenReader({ stories }: { stories: StoryCluster[] }) {
  return (
    <section aria-label="Stories" role="feed" className="space-y-3 rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Screen-reader view — all stories</p>
      <p className="text-xs text-muted">Navigate with headings (H2 per story). Each story lists location, summary, sources, timeline and where accounts differ.</p>
      {stories.length===0 ? <p className="text-sm text-muted">No stories.</p> : stories.map(s=> (
        <article key={s.id} aria-labelledby={`sr-${s.id}`} className="rounded-lg border border-rule bg-panel-soft p-3">
          <h2 id={`sr-${s.id}`} className="text-sm font-semibold">{s.headline}</h2>
          <p className="mt-0.5 text-xs text-muted">{s.topic}{s.location?.label? ` · ${s.location.label}`:""} · significance {s.significance??"—"}/100</p>
          <p className="mt-1.5 text-sm text-muted">{s.summary}</p>
          {s.keyPoints.length>0 && <ul className="mt-2 list-disc pl-5 text-sm text-muted">{s.keyPoints.map((k,i)=><li key={i}>{k}</li>)}</ul>}
          {s.widelyAgreedFacts.length>0 && <p className="mt-2 text-xs"><span className="font-medium text-success">Widely agreed:</span> <span className="text-muted">{s.widelyAgreedFacts.join(" · ")}</span></p>}
          {s.uncertainty.length>0 && <p className="mt-1 text-xs"><span className="font-medium">Uncertainty:</span> <span className="text-muted">{s.uncertainty.join(" · ")}</span></p>}
          {s.timeline.length>0 && <ol className="mt-2 border-l border-rule pl-3 text-xs text-muted">{s.timeline.slice(0,6).map((e,i)=><li key={i}><span className="font-medium text-foreground">{e.date}</span> — {e.label}</li>)}</ol>}
          {s.sources.length>0 && <p className="mt-2 text-xs">Sources: {s.sources.slice(0,4).map(u=> <a key={u.url} href={u.url} className="mr-2 text-accent underline">{u.publisher ?? u.url}</a>)}</p>}
        </article>
      ))}
      <p className="text-[11px] text-muted">Tip: enable Lite mode (?lite=1) for a globe-free, low-bandwidth experience.</p>
    </section>
  );
}
