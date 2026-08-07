"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEntries } from "@/lib/useEntries";
import type { Entry, ToastState } from "@/lib/types";
import EntryList from "@/components/EntryList";
import ApiKeyBar from "@/components/ApiKeyBar";
import NewEntryForm from "@/components/NewEntryForm";
import ReflectionSession from "@/components/ReflectionSession";
import InsightsView from "@/components/InsightsView";
import Toast from "@/components/Toast";

export default function Home() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("reflectEntries", []);
  const [apiKey, setApiKey] = useLocalStorage<string>("anthropicApiKey", "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { startEntry, appendMessage, completeEntry, updateFollowUp, deleteEntry } = useEntries(
    entries,
    setEntries,
  );

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  function handleNew() {
    setSelectedId(null);
    setCreatingNew(true);
    setShowInsights(false);
  }

  function handleStart(situation: string) {
    const entry = startEntry(situation);
    setSelectedId(entry.id);
    setCreatingNew(false);
    setShowInsights(false);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setCreatingNew(false);
    setShowInsights(false);
  }

  function handleDelete(id: string) {
    deleteEntry(id);
    if (selectedId === id) setSelectedId(null);
  }

  function handleInsights() {
    setSelectedId(null);
    setCreatingNew(false);
    setShowInsights(true);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <ApiKeyBar apiKey={apiKey} onChange={setApiKey} />
      <div className="flex flex-1 overflow-hidden">
        <EntryList
          entries={entries}
          selectedId={selectedId}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onNew={handleNew}
          onInsights={handleInsights}
        />
        <div className="flex-1 overflow-hidden">
          {showInsights && (
            <InsightsView
              entries={entries}
              onBack={() => setShowInsights(false)}
            />
          )}
          {!showInsights && selectedEntry && (
            <ReflectionSession
              key={selectedEntry.id}
              entry={selectedEntry}
              apiKey={apiKey}
              onAppendMessage={appendMessage}
              onCompleteEntry={completeEntry}
              onUpdateFollowUp={updateFollowUp}
              onError={(message) => setToast({ message })}
            />
          )}
          {!showInsights && !selectedEntry && creatingNew && (
            <NewEntryForm onSubmit={handleStart} />
          )}
          {!showInsights && !selectedEntry && !creatingNew && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center animate-fade-in">
              <span className="text-4xl opacity-80">🪞</span>
              <p className="text-sm font-medium text-foreground">
                Select a reflection, or start a new one
              </p>
              <p className="max-w-xs text-xs text-muted">
                Reflect helps you look past the first emotion and understand
                what's actually going on before you act.
              </p>
              <button
                onClick={handleNew}
                className="mt-2 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover"
              >
                + New reflection
              </button>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <Toast message={toast.message} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
