"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEntries } from "@/lib/useEntries";
import type { Entry, ToastState } from "@/lib/types";
import EntryList from "@/components/EntryList";
import ApiKeyBar from "@/components/ApiKeyBar";
import NewEntryForm from "@/components/NewEntryForm";
import ReflectionSession from "@/components/ReflectionSession";
import Toast from "@/components/Toast";

export default function Home() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("reflectEntries", []);
  const [apiKey, setApiKey] = useLocalStorage<string>("anthropicApiKey", "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { startEntry, appendMessage, completeEntry, deleteEntry } = useEntries(entries, setEntries);

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  function handleNew() {
    setSelectedId(null);
    setCreatingNew(true);
  }

  function handleStart(situation: string) {
    const entry = startEntry(situation);
    setSelectedId(entry.id);
    setCreatingNew(false);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setCreatingNew(false);
  }

  function handleDelete(id: string) {
    deleteEntry(id);
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="flex h-screen flex-col">
      <ApiKeyBar apiKey={apiKey} onChange={setApiKey} />
      <div className="flex flex-1 overflow-hidden">
        <EntryList
          entries={entries}
          selectedId={selectedId}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onNew={handleNew}
        />
        <div className="flex-1 overflow-hidden">
          {selectedEntry && (
            <ReflectionSession
              key={selectedEntry.id}
              entry={selectedEntry}
              apiKey={apiKey}
              onAppendMessage={appendMessage}
              onCompleteEntry={completeEntry}
              onError={(message) => setToast({ message })}
            />
          )}
          {!selectedEntry && creatingNew && <NewEntryForm onSubmit={handleStart} />}
          {!selectedEntry && !creatingNew && (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Select a reflection, or start a new one.
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
