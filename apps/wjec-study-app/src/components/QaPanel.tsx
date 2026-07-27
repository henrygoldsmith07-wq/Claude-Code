"use client";

import { useRef, useState } from "react";
import { useQaAssistant } from "@/lib/useQaAssistant";
import type { AnchorDocument, QaMessage } from "@/lib/types";

interface Props {
  apiKey: string;
  initialDocuments: AnchorDocument[];
  initialHistory: QaMessage[];
}

export default function QaPanel({ apiKey, initialDocuments, initialHistory }: Props) {
  const {
    documents,
    activeDocumentId,
    setActiveDocumentId,
    addDocument,
    removeDocument,
    history,
    addMessage,
    clearHistory,
  } = useQaAssistant({ documents: initialDocuments, history: initialHistory });

  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"direct" | "guided">("direct");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDocument = documents.find((d) => d.id === activeDocumentId) ?? null;

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    addMessage("user", trimmed);
    setQuestion("");
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          mode,
          anchorText: activeDocument?.sourceText ?? null,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get an answer");
      addMessage("assistant", data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get an answer");
    } finally {
      setSending(false);
    }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Only .txt files are supported for upload — paste other text directly.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addDocument(file.name, String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-medium">Document anchoring</p>
        <p className="mt-1 text-xs text-ink3">
          Paste notes or upload a .txt file; while a document is active, answers are drawn only
          from it.
        </p>
        <textarea
          rows={3}
          placeholder="Paste source text here…"
          className="mt-2 w-full rounded-lg border border-line p-2 text-sm"
          onBlur={(e) => {
            if (e.target.value.trim()) {
              addDocument(`Pasted note (${new Date().toLocaleDateString()})`, e.target.value.trim());
              e.target.value = "";
            }
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-line px-3 py-1 hover:bg-surface2 dark:hover:bg-surface"
          >
            Upload .txt
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {documents.map((doc) => (
            <span
              key={doc.id}
              className={
                doc.id === activeDocumentId
                  ? "flex items-center gap-1 rounded-full bg-speaksoft px-3 py-1"
                  : "flex items-center gap-1 rounded-full bg-surface2 px-3 py-1"
              }
            >
              <button onClick={() => setActiveDocumentId(doc.id)}>{doc.title}</button>
              <button onClick={() => removeDocument(doc.id)} className="text-ink3">
                ×
              </button>
            </span>
          ))}
          {activeDocument && (
            <button onClick={() => setActiveDocumentId(null)} className="text-ink3 hover:underline">
              Stop anchoring
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMode("direct")}
              className={
                mode === "direct"
                  ? "rounded-full bg-surface px-3 py-1 text-onaccent dark:bg-surface"
                  : "rounded-full border border-line px-3 py-1"
              }
            >
              Instant answer
            </button>
            <button
              onClick={() => setMode("guided")}
              className={
                mode === "guided"
                  ? "rounded-full bg-surface px-3 py-1 text-onaccent dark:bg-surface"
                  : "rounded-full border border-line px-3 py-1"
              }
            >
              Guided learning
            </button>
          </div>
          {history.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-ink3 hover:underline">
              Clear chat
            </button>
          )}
        </div>

        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {history.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "self-end rounded-2xl bg-surface px-4 py-2 text-sm text-onaccent dark:bg-surface"
                  : "self-start whitespace-pre-wrap rounded-2xl bg-surface2 px-4 py-2 text-sm"
              }
            >
              {m.content}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about your A-level subjects…"
            className="flex-1 rounded-full border border-line px-4 py-2 text-sm"
          />
          <button
            onClick={handleAsk}
            disabled={sending || !question.trim()}
            className="rounded-full bg-surface px-4 py-2 text-sm text-onaccent disabled:opacity-40 dark:bg-surface"
          >
            {sending ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
