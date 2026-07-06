"use client";

import { useCallback, useState } from "react";
import {
  addAnchorDocumentAction,
  addQaMessageAction,
  clearQaHistoryAction,
  removeAnchorDocumentAction,
} from "./supabase/actions";
import type { AnchorDocument, QaMessage } from "./types";

export function useQaAssistant(initial: { documents: AnchorDocument[]; history: QaMessage[] }) {
  const [documents, setDocuments] = useState<AnchorDocument[]>(initial.documents);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [history, setHistory] = useState<QaMessage[]>(initial.history);

  const addDocument = useCallback(async (title: string, sourceText: string) => {
    const tempId = `local-${Date.now()}`;
    const doc: AnchorDocument = { id: tempId, title, sourceText, createdAt: new Date().toISOString() };
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocumentId(tempId);
    try {
      const id = await addAnchorDocumentAction(title, sourceText);
      setDocuments((prev) => prev.map((d) => (d.id === tempId ? { ...d, id } : d)));
      setActiveDocumentId((prev) => (prev === tempId ? id : prev));
    } catch {
      setDocuments((prev) => prev.filter((d) => d.id !== tempId));
    }
    return doc;
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setActiveDocumentId((prev) => (prev === id ? null : prev));
    void removeAnchorDocumentAction(id);
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    const message: QaMessage = {
      id: `local-${Date.now()}-${role}`,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => [...prev, message]);
    void addQaMessageAction(role, content);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    void clearQaHistoryAction();
  }, []);

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
