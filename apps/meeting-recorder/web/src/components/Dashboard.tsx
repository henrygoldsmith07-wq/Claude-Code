"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { mmss, relativeTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { SearchMemory } from "./SearchMemory";
import { CollectionsPanel } from "./CollectionsPanel";
import type { Collection } from "@/lib/collections";

export function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Meeting["status"]>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [bench, setBench] = useState<{ insights?: unknown; transcription?: unknown } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/meetings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load meetings (${res.status})`);
      const data = (await res.json()) as { meetings: Meeting[] };
      setMeetings(data.meetings);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    fetch("/api/benchmarks", { cache: "no-store" }).then((r)=>r.json()).then(setBench).catch(()=>{});
    return () => clearInterval(t);
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this recording? This cannot be undone.")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((m) => m?.filter((x) => x.id !== id) ?? null);
  }

  function copyShare(shareId: string, meetingId: string) {
    const url = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard?.writeText(url).then(() => { setCopiedId(meetingId); setTimeout(() => setCopiedId(null), 1800); });
  }

  const filtered = useMemo(() => {
    if (!meetings) return null;
    const q = query.trim().toLowerCase();
    return meetings.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.transcript?.text.toLowerCase().includes(q) && !m.summary?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [meetings, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="mt-1 text-sm text-white/40">Recordings from the desktop app appear here automatically. Searchable meeting memory with collections.</p>
        </div>
        {meetings && meetings.length > 0 && <p className="text-xs text-white/40 tabular">{filtered?.length ?? 0} of {meetings.length}</p>}
      </div>

      <p className="text-xs text-white/30">Search also checks transcript & summary. Decisions/actions on each meeting link to transcript evidence. Collections group by topic/project.</p>
      {meetings && meetings.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meetings…" className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-white/30 sm:max-w-xs" aria-label="Search meetings" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-white/30" aria-label="Filter by status">
            <option value="all">All statuses</option><option value="ready">Ready</option><option value="processing">Transcribing</option><option value="uploading">Uploading</option><option value="error">Error</option>
          </select>
        </div>
      )}

      {meetings && meetings.length > 0 && <SearchMemory meetings={meetings} />}
      {meetings && <CollectionsPanel meetings={meetings} collections={collections} onCreate={(c)=> setCollections((prev)=>[...prev,c])} />}

      {bench && (
        <details className="rounded-xl border border-edge bg-panel p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white/70">Benchmarks (hallucination · decision/action P/R · transcription cost)</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-ink p-3 text-xs text-white/60">{JSON.stringify(bench, null, 2)}</pre>
          <p className="mt-2 text-xs text-white/30">Benchmarks: human-labelled corpus (precision/recall), grounding (owner without evidence flagged), provider cost routing.</p>
        </details>
      )}

      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">{error}</div>}
      {meetings === null && !error && <p className="text-sm text-white/40">Loading…</p>}
      {meetings?.length === 0 && <div className="rounded-xl border border-dashed border-edge p-10 text-center text-sm text-white/40">No meetings yet. Open the desktop recorder, hit record, and stop — it’ll show up here.</div>}
      {filtered && filtered.length === 0 && meetings && meetings.length > 0 && <div className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-white/40">No meetings match your search.</div>}

      <div className="grid gap-3">
        {filtered?.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-edge bg-panel px-4 py-3">
            <Link href={`/meeting/${m.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.title}</p>
              <p className="mt-0.5 text-xs text-white/40">{relativeTime(m.createdAt)}{m.durationSec > 0 && <> · {mmss(m.durationSec)}</>} · <span className={statusClass(m.status)}>{statusLabel(m.status)}</span></p>
            </Link>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <button onClick={() => copyShare(m.shareId, m.id)} className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-white/60 hover:text-white" title="Copy share link">{copiedId === m.id ? "Copied!" : "Share"}</button>
              <button onClick={() => remove(m.id)} className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-white/40 hover:text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: Meeting["status"]): string {
  switch (status) { case "ready": return "Ready"; case "processing": return "Transcribing…"; case "error": return "Error"; default: return "Uploading…"; }
}
function statusClass(status: Meeting["status"]): string {
  switch (status) { case "ready": return "text-emerald-400"; case "processing": return "text-amber-300"; case "error": return "text-red-400"; default: return "text-white/50"; }
}
