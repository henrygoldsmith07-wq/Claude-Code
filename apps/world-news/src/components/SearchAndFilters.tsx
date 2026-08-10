"use client";
import { useMemo, useState } from "react";
import { TOPICS } from "@/lib/gemini";
import type { StoryCluster } from "@/lib/storyModel";

export default function SearchAndFilters({
  stories,
  onFiltered,
}: {
  stories: StoryCluster[];
  onFiltered: (ids: string[] | null) => void; // null = no filter
}) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const countries = useMemo(()=> Array.from(new Set(stories.map(s=> s.location?.countryCode ?? s.sources[0]?.countryCode).filter(Boolean) as string[])).sort(), [stories]);

  const apply = (nq: string, nt: string, nc: string) => {
    const query = nq.trim().toLowerCase();
    const ids = stories.filter(s=>{
      if (nt !== "all" && s.topic !== nt) return false;
      if (nc !== "all") {
        const cc = s.location?.countryCode ?? s.sources[0]?.countryCode ?? "";
        if (cc !== nc) return false;
      }
      if (!query) return true;
      const hay = `${s.headline} ${s.summary} ${s.topic} ${(s.keyPoints ?? []).join(" ")}`.toLowerCase();
      return hay.includes(query);
    }).map(s=>s.id);
    onFiltered(ids.length === stories.length ? null : ids);
  };

  return (
    <div className="rounded-xl border border-rule bg-panel p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={e=>{ setQ(e.target.value); apply(e.target.value, topic, country); }}
          placeholder="Search stories — e.g. ‘ceasefire’, ‘tariffs’, ‘Kyiv’"
          className="min-w-[220px] flex-1 rounded-lg border border-rule bg-panel-soft px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select value={topic} onChange={e=>{ setTopic(e.target.value); apply(q, e.target.value, country); }} className="rounded-lg border border-rule bg-panel-soft px-2 py-2 text-sm">
          <option value="all">All topics</option>
          {TOPICS.map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={country} onChange={e=>{ setCountry(e.target.value); apply(q, topic, e.target.value); }} className="rounded-lg border border-rule bg-panel-soft px-2 py-2 text-sm">
          <option value="all">All countries</option>
          {countries.map(c=> <option key={c} value={c}>{c}</option>)}
        </select>
        {(q || topic!=="all" || country!=="all") && (
          <button type="button" onClick={()=>{ setQ(""); setTopic("all"); setCountry("all"); onFiltered(null); }} className="rounded-lg border border-rule px-3 py-2 text-sm hover:border-accent">Clear</button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">Country/topic filters also narrow the globe dots. “What changed since yesterday?” sits above stories when available.</p>
    </div>
  );
}
