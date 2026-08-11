"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEntries } from "@/lib/useEntries";
import type { Entry, ToastState } from "@/lib/types";
import { unresolvedEntries } from "@/lib/longitudinal";
import { searchEntries, semanticSearch } from "@/lib/search";
import { isPulseOptIn, emitPulse } from "@/lib/pulse";
import EntryList from "@/components/EntryList";
import ApiKeyBar from "@/components/ApiKeyBar";
import NewEntryForm from "@/components/NewEntryForm";
import ReflectionSession from "@/components/ReflectionSession";
import InsightsView from "@/components/InsightsView";
import TimelineView from "@/components/TimelineView";
import LongitudinalPanel from "@/components/LongitudinalPanel";
import PrivacyBar from "@/components/PrivacyBar";
import Toast from "@/components/Toast";

type MainView = "reflections" | "insights" | "timeline" | "longitudinal" | "privacy";

export default function Home() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("reflectEntries", []);
  const [apiKey, setApiKey] = useLocalStorage<string>("geminiApiKey", "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [view, setView] = useState<MainView>("reflections");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [q, setQ] = useState("");
  const [semantic, setSemantic] = useState(false);

  const { startEntry, appendMessage, completeEntry, updateFollowUp, updateLongitudinalReview, clearLongitudinalReview, deleteEntry } = useEntries(
    entries,
    setEntries,
  );

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  const unresolved = useMemo(() => unresolvedEntries(entries), [entries]);

  const filteredEntries = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed) return entries;
    if (semantic) {
      const hits = semanticSearch(entries, trimmed, 50);
      const ids = new Set(hits.map((h) => h.entry.id));
      // keep hits first in rank order, then non-hits filtered out
      const ranked = hits.map((h) => h.entry);
      // if nothing scored, fall back to text search so user still sees substring matches
      if (ranked.length === 0) return searchEntries(entries, trimmed);
      // append any text matches not already in semantic hits (rare)
      const textExtra = searchEntries(entries, trimmed).filter((e) => !ids.has(e.id));
      return [...ranked, ...textExtra];
    }
    return searchEntries(entries, trimmed);
  }, [entries, q, semantic]);

  // Pulse: emit aggregated snapshot on change when explicitly opted in
  useEffect(() => {
    if (!isPulseOptIn()) return;
    // throttle: only emit when entries length changes or review changes
    const t = window.setTimeout(() => emitPulse(entries), 400);
    return () => window.clearTimeout(t);
  }, [entries]);

  function handleNew() {
    setSelectedId(null);
    setCreatingNew(true);
    setView("reflections");
  }

  function handleStart(situation: string) {
    const entry = startEntry(situation);
    setSelectedId(entry.id);
    setCreatingNew(false);
    setView("reflections");
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setCreatingNew(false);
    setView("reflections");
  }

  function handleDelete(id: string) {
    deleteEntry(id);
    if (selectedId === id) setSelectedId(null);
  }

  function switchView(v: MainView) {
    setSelectedId(null);
    setCreatingNew(false);
    setView(v);
  }

  const localOnly = typeof window !== "undefined" && window.localStorage.getItem("reflectLocalOnly") === "1";

  return (
    <div className="flex h-screen flex-col bg-background">
      <ApiKeyBar apiKey={apiKey} onChange={setApiKey} />
      {localOnly && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800">
          Local-only mode is on — new reflections won&apos;t call the AI. Structured traces still work; turn it off in Privacy to re-enable guided reflection.
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs">
          <span className="font-medium text-amber-800">{unresolved.length} follow-up{unresolved.length === 1 ? "" : "s"} due</span>
          <span className="text-amber-700/80">— predicted vs actual is ready to calibrate.</span>
          <div className="flex flex-wrap gap-1">
            {unresolved.slice(0, 4).map((e) => (
              <button key={e.id} onClick={() => handleSelect(e.id)} className="rounded-full border border-amber-500/30 bg-card px-2 py-0.5 text-xs hover:bg-card-hover">
                {e.title.slice(0, 28)}
              </button>
            ))}
          </div>
          <button onClick={() => switchView("longitudinal")} className="ml-auto rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700">
            Review all →
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
          <EntryList
            entries={filteredEntries}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onNew={handleNew}
            onInsights={() => switchView("insights")}
          />
          <div className="border-t border-border p-2">
            <div className="flex gap-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={semantic ? "Semantic search…" : "Search reflections…"}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent/20"
              />
              <button
                onClick={() => setSemantic((v) => !v)}
                title={semantic ? "Semantic (TF-IDF) — click for plain text" : "Plain text — click for semantic"}
                className={`shrink-0 rounded-lg border px-2 py-1.5 text-xs font-medium ${semantic ? "border-accent bg-accent text-white" : "border-border bg-card text-muted hover:bg-card-hover"}`}
              >
                {semantic ? "◆" : "⌕"}
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {(["timeline", "longitudinal", "privacy"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`rounded-lg border px-1.5 py-1 text-[11px] font-medium capitalize ${view === v ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted hover:bg-card-hover"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {q.trim() && <p className="mt-1 text-[11px] text-muted">{filteredEntries.length} match{filteredEntries.length === 1 ? "" : "es"} · {semantic ? "semantic" : "text"}</p>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedEntry ? (
            <ReflectionSession
              key={selectedEntry.id}
              entry={selectedEntry}
              entries={entries}
              apiKey={apiKey}
              onAppendMessage={appendMessage}
              onCompleteEntry={completeEntry}
              onUpdateFollowUp={updateFollowUp}
              onSaveReview={updateLongitudinalReview}
              onClearReview={clearLongitudinalReview}
              onError={(message) => setToast({ message })}
            />
          ) : creatingNew ? (
            <NewEntryForm onSubmit={handleStart} />
          ) : view === "insights" ? (
            <InsightsView entries={entries} onBack={() => setView("reflections")} />
          ) : view === "timeline" ? (
            <div className="mx-auto max-w-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <button onClick={() => setView("reflections")} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-card-hover">← Back</button>
              </div>
              <TimelineView entries={entries} onSelect={handleSelect} />
            </div>
          ) : view === "longitudinal" ? (
            <div className="mx-auto max-w-3xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Longitudinal</h2>
                  <p className="text-xs text-muted">Calibration, recurring patterns, contradictions, predicted vs actual, weekly/monthly reviews.</p>
                </div>
                <button onClick={() => setView("reflections")} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-card-hover">← Back</button>
              </div>
              <LongitudinalPanel entries={entries} onSelect={handleSelect} />
            </div>
          ) : view === "privacy" ? (
            <div className="mx-auto max-w-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Privacy & data</h2>
                <button onClick={() => setView("reflections")} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-card-hover">← Back</button>
              </div>
              <PrivacyBar entries={entries} setEntries={setEntries} />
              <div className="mt-6">
                <LongitudinalPanel entries={entries} onSelect={handleSelect} />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center animate-fade-in">
              <span className="text-4xl opacity-80">🪞</span>
              <p className="text-sm font-medium text-foreground">Select a reflection, or start a new one</p>
              <p className="max-w-xs text-xs text-muted">Reflect helps you look past the first emotion and understand what&apos;s actually going on before you act.</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button onClick={handleNew} className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover">+ New reflection</button>
                <button onClick={() => switchView("longitudinal")} className="rounded-xl border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-card-hover">Longitudinal</button>
              </div>
              <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-muted">Local-only mode keeps everything in this browser. Encryption uses WebCrypto AES-GCM. Pulse only sends aggregated counts when you explicitly opt in.</p>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
