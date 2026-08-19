"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEntries } from "@/lib/useEntries";
import type { BiasFlag, Entry, LongitudinalReview, ReflectionMode, ReflectionSummary, ToastState } from "@/lib/types";
import { unresolvedEntries } from "@/lib/longitudinal";
import { automaticSearch } from "@/lib/search";
import { isPulseOptIn, emitPulse } from "@/lib/pulse";
import { patternKey, type Correction } from "@/lib/corrections";
import { isOutcomeStudyOptIn, logOutcomeStudyEvent } from "@/lib/outcomeStudy";
import MainNav, { type MainView } from "@/components/MainNav";
import HistoryView from "@/components/HistoryView";
import PatternsView from "@/components/PatternsView";
import SettingsView from "@/components/SettingsView";
import NewEntryForm from "@/components/NewEntryForm";
import ReflectionSession from "@/components/ReflectionSession";
import Toast from "@/components/Toast";

export default function Home() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("reflectEntries", []);
  const [corrections, setCorrections] = useLocalStorage<Correction[]>("reflectCorrections", []);
  const [apiKey, setApiKey] = useLocalStorage<string>("geminiApiKey", "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newMode, setNewMode] = useState<ReflectionMode>("full");
  const [view, setView] = useState<MainView>("reflect");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [query, setQuery] = useState("");

  const { startEntry, appendMessage, completeEntry, updateFollowUp, updateLongitudinalReview, clearLongitudinalReview, deleteEntry } = useEntries(entries, setEntries);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const unresolved = useMemo(() => unresolvedEntries(entries), [entries]);
  const filteredEntries = useMemo(() => automaticSearch(entries, query, 50), [entries, query]);

  useEffect(() => {
    if (!isPulseOptIn()) return;
    const timer = window.setTimeout(() => emitPulse(entries), 400);
    return () => window.clearTimeout(timer);
  }, [entries]);

  function switchView(next: MainView): void {
    setSelectedId(null);
    setCreatingNew(false);
    setView(next);
  }

  function handleNew(mode: ReflectionMode = "full"): void {
    setNewMode(mode);
    setSelectedId(null);
    setCreatingNew(true);
    setView("reflect");
  }

  function handleStart(situation: string, mode: ReflectionMode): void {
    const entry = startEntry(situation, mode);
    if (isOutcomeStudyOptIn()) logOutcomeStudyEvent({ type: "reflection_started", mode });
    setSelectedId(entry.id);
    setCreatingNew(false);
    setView("reflect");
  }

  function handleSelect(id: string): void {
    setSelectedId(id);
    setCreatingNew(false);
    setView("reflect");
  }

  function handleDelete(id: string): void {
    deleteEntry(id);
    if (selectedId === id) setSelectedId(null);
  }

  function handleCompleteEntry(id: string, summary: ReflectionSummary): void {
    completeEntry(id, summary);
    if (isOutcomeStudyOptIn()) logOutcomeStudyEvent({ type: "reflection_completed", mode: entries.find((entry) => entry.id === id)?.mode ?? "full" });
  }

  function handleUpdateFollowUp(id: string, at: string | null, note: string | null): void {
    updateFollowUp(id, at, note);
    if (at && isOutcomeStudyOptIn()) logOutcomeStudyEvent({ type: "follow_up_scheduled", mode: entries.find((entry) => entry.id === id)?.mode ?? "full" });
  }

  function handleSaveReview(id: string, patch: Partial<LongitudinalReview>): void {
    updateLongitudinalReview(id, patch);
    if (patch.actualOutcome && patch.assumptionVerdict && isOutcomeStudyOptIn()) logOutcomeStudyEvent({ type: "outcome_reviewed", mode: entries.find((entry) => entry.id === id)?.mode ?? "full", verdict: patch.assumptionVerdict });
  }

  function handleDismissCorrection(correction: Correction): void {
    setCorrections((current) => current.some((item) => item.key === correction.key) ? current : [...current, correction]);
    if (isOutcomeStudyOptIn()) logOutcomeStudyEvent({ type: "pattern_corrected" });
    setToast({ message: "Pattern hidden. You can still find the underlying reflections in History." });
  }

  function handleDismissBias(bias: BiasFlag): void {
    handleDismissCorrection({ key: patternKey({ kind: "bias", label: bias.type }), kind: "pattern", rejectedAt: new Date().toISOString(), reason: "User asked to stop showing this pattern." });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
          <button type="button" onClick={() => switchView("reflect")} className="flex items-center gap-2.5 text-left">
            <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" aria-hidden="true" />
            <span><span className="block text-sm font-semibold tracking-tight">Reflect</span><span className="block text-[10px] text-muted">Make space for a better read</span></span>
          </button>
          <div className="ml-auto"><MainNav view={view} onChange={switchView} /></div>
        </div>
      </header>

      {unresolved.length > 0 && <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2"><span className="font-medium text-amber-800">{unresolved.length} follow-up{unresolved.length === 1 ? "" : "s"} due</span><span className="text-amber-700/80">— compare what you predicted with what actually happened.</span>{unresolved.slice(0, 3).map((entry) => <button key={entry.id} type="button" onClick={() => handleSelect(entry.id)} className="rounded-full border border-amber-500/30 bg-card px-2 py-0.5 hover:bg-card-hover">{entry.title.slice(0, 28)}</button>)}<button type="button" onClick={() => switchView("patterns")} className="ml-auto rounded-lg bg-amber-600 px-2.5 py-1 font-medium text-white hover:bg-amber-700">Review all →</button></div></div>}

      <main className="flex-1 overflow-y-auto">
        {selectedEntry ? (
          <ReflectionSession key={selectedEntry.id} entry={selectedEntry} entries={entries} apiKey={apiKey} onAppendMessage={appendMessage} onCompleteEntry={handleCompleteEntry} onUpdateFollowUp={handleUpdateFollowUp} onSaveReview={handleSaveReview} onClearReview={clearLongitudinalReview} onDismissPattern={handleDismissBias} onError={(message) => setToast({ message })} />
        ) : creatingNew ? (
          <NewEntryForm initialMode={newMode} onSubmit={handleStart} />
        ) : view === "history" ? (
          <>
            <div className="mx-auto max-w-4xl px-5 pt-5 sm:px-8 sm:pt-8"><label className="sr-only" htmlFor="history-search">Search history</label><input id="history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your history…" className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20" />{query.trim() && <p className="mt-1.5 text-xs text-muted">{filteredEntries.length} result{filteredEntries.length === 1 ? "" : "s"} · automatic local relevance search</p>}</div>
            <HistoryView entries={filteredEntries} selectedId={selectedId} onSelect={handleSelect} onDelete={handleDelete} onNew={handleNew} />
          </>
        ) : view === "patterns" ? (
          <PatternsView entries={entries} corrections={corrections} onSelect={handleSelect} onDismissPattern={handleDismissCorrection} />
        ) : view === "settings" ? (
          <SettingsView entries={entries} setEntries={setEntries} apiKey={apiKey} setApiKey={setApiKey} />
        ) : (
          <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center animate-fade-in"><span className="text-4xl opacity-80">🪞</span><div><p className="text-2xl font-semibold tracking-tight">What needs a better read?</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Reflect separates what happened from the story your mind added, then gives you a prediction to check against reality.</p></div><div className="mt-2 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => handleNew("quick")} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-card-hover">Quick reflection</button><button type="button" onClick={() => handleNew("full")} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent-hover">Full reflection →</button></div><button type="button" onClick={() => switchView("patterns")} className="mt-2 text-xs font-medium text-accent hover:underline">See your patterns</button><p className="mt-5 max-w-sm text-[11px] leading-relaxed text-muted">Stored in this browser. Guided steps use your configured AI connection only when you send an answer. Follow-ups help test predictions rather than treating them as facts.</p></div>
        )}
      </main>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
