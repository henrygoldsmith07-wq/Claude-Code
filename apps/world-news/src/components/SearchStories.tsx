"use client";
import { useMemo, useState } from "react";
import type { StoryCluster } from "@/lib/storyModel";

function scoreHay(hay: string, q: string): number {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s=0; for (const t of terms) if (hay.includes(t)) s++; return s;
}

export default function SearchStories({ stories }: { stories: StoryCluster[] }) {
  const [q, setQ] = useState("");
  const results = useMemo(()=> {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const ranked = stories.map(s=> {
      const hay = `${s.headline} ${s.summary} ${s.topic} ${s.keyPoints.join(" ")} ${s.location?.label ?? ""}`.toLowerCase();
      return { s, score: scoreHay(hay, query) };
    }).filter(r=> r.score>0).sort((a,b)=> b.score-a.score).slice(0,12);
    return ranked;
  }, [q, stories]);

  return (
    <div className="rounded-xl border border-rule bg-panel p-3">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search stories, headlines, locations — e.g. ‘ceasefire’, ‘Kyiv’, ‘tariffs’" className="w-full rounded-lg border border-rule bg-panel-soft px-3 py-2 text-sm outline-none focus:border-accent" aria-label="Search stories" />
      {q && (
        <div className="mt-3">
          {!results || results.length===0 ? <p className="text-sm text-muted">No matches. Try fewer keywords or another topic/country.</p> : (
            <ul className="space-y-2">
              {results.map(r=> (
                <li key={r.s.id} className="rounded-lg border border-rule bg-panel-soft p-2">
                  <p className="text-sm font-medium">{r.s.headline} <span className="text-xs text-muted">· {r.s.topic}{r.s.location?.label?` · ${r.s.location.label}`:""}</span></p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.s.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">Keyboard: focus the box and press Esc to clear. Stories are in a feed below for screen readers.</p>
    </div>
  );
}
