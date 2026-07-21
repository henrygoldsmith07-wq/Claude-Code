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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { startEntry, appendMessage, completeEntry, deleteEntry } = useEntries(entries, setEntries);

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  function handleNew() {
    setSelectedId(null);
    setCreatingNew(true);
    setSidebarOpen(false);
  }

  function handleStart(situation: string) {
    const entry = startEntry(situation);
    setSelectedId(entry.id);
    setCreatingNew(false);
    setSidebarOpen(false);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setCreatingNew(false);
    setSidebarOpen(false);
  }

  function handleDelete(id: string) {
    deleteEntry(id);
    if (selectedId === id) setSelectedId(null);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reflect-entries-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: "Exported all reflections as JSON" });
  }

  return (
    <div className="flex h-screen flex-col">
      <ApiKeyBar apiKey={apiKey} onChange={setApiKey} />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white transition-transform dark:bg-zinc-950 sm:static sm:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 sm:hidden dark:border-zinc-800">
            <span className="text-sm font-medium">Reflections</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              ✕
            </button>
          </div>
          <EntryList
            entries={entries}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onNew={handleNew}
          />
          {entries.length > 0 && (
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <button
                onClick={handleExport}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                ↓ Export all as JSON
              </button>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 sm:hidden dark:border-zinc-800">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700"
            >
              ☰ Menu
            </button>
            <span className="truncate text-sm font-medium">
              {selectedEntry?.title ?? (creatingNew ? "New reflection" : "Reflect")}
            </span>
          </div>

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
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                  Reflect deeper than a mood log
                </p>
                <p className="max-w-sm text-sm text-zinc-500">
                  Describe a situation. Claude will ask probing questions to help you find
                  what's actually underneath the surface emotion — before you act on it.
                </p>
                <button
                  onClick={handleNew}
                  className="mt-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Start a new reflection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
