"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { AnchorDocument, QaMessage } from "./types";

export function useQaAssistant() {
  const [documents, setDocuments] = useLocalStorage<AnchorDocument[]>("wjec-anchor-documents", []);
  const [activeDocumentId, setActiveDocumentId] = useLocalStorage<string | null>(
    "wjec-active-anchor-document",
    null,
  );
  const [history, setHistory] = useLocalStorage<QaMessage[]>("wjec-qa-history", []);

  const addDocument = useCallback(
    (title: string, sourceText: string) => {
      const doc: AnchorDocument = {
        id: `doc-${Date.now()}`,
        title,
        sourceText,
        createdAt: new Date().toISOString(),
      };
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocumentId(doc.id);
      return doc;
    },
    [setDocuments, setActiveDocumentId],
  );

  const removeDocument = useCallback(
    (id: string) => {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setActiveDocumentId((prev) => (prev === id ? null : prev));
    },
    [setDocuments, setActiveDocumentId],
  );

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const message: QaMessage = {
        id: `qa-${Date.now()}-${role}`,
        role,
        content,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [...prev, message]);
    },
    [setHistory],
  );

  const clearHistory = useCallback(() => setHistory([]), [setHistory]);

  return {
    documents,
    activeDocumentId,
    setActiveDocumentId,
    addDocument,
    removeDocument,
    history,
    addMessage,
    clearHistory,
  };
}
