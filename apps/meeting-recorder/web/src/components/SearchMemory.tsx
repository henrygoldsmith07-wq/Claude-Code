"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { semanticSearch, crossMeetingSearch } from "@/lib/semanticSearch";

export function SearchMemory({ meetings }: { meetings: Meeting[] }) {
  const [q, setQ] = useState("");
  const [cross, setCross] = useState(false);
  const hits = useMemo(() => {
    if (!q.trim()) return [];
    return cross ? crossMeetingSearch(meetings, q).slice(0, 12) : semanticSearch(meetings, q, 12);
  }, [meetings, q, cross]);
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Searchable memory</h2>
      <p className="mt-1 text-xs text-white/40">Semantic + cross-meeting. Every hit links to the meeting and evidence.</p>
      <div className="mt-3 flex gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search across meetings…" className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-white/30" aria-label="Search meetings semantic" />
        <label className="flex items-center gap-1 text-xs text-white/50"><input type="checkbox" checked={cross} onChange={(e)=>setCross(e.target.checked)} /> cross-meeting</label>
      </div>
      <div className="mt-3 space-y-2" role="feed" aria-label="Search results">
        {q && hits.length===0 && <p className="text-xs text-white/40">No hits.</p>}
        {hits.map((h)=>(
          <Link key={h.meeting.id} href={`/meeting/${h.meeting.id}`} className="block rounded-lg border border-edge bg-ink px-3 py-2 hover:border-white/20">
            <p className="truncate text-sm font-medium">{h.meeting.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-white/50">{h.snippet}</p>
            <p className="mt-1 text-xs text-white/30">score {h.score.toFixed(2)}{"crossMeetingCount" in h ? ` · ${(h as unknown as { crossMeetingCount: number }).crossMeetingCount} meetings` : ""}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
