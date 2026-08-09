import type { Entry, LongitudinalReview, Message, ReflectionSummary } from "./types";

type SetEntries = (value: Entry[] | ((current: Entry[]) => Entry[])) => void;

function deriveTitle(situation: string): string {
  const firstLine = situation.trim().split("\n")[0];
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine || "Untitled reflection";
}

export function useEntries(entries: Entry[], setEntries: SetEntries) {
  function startEntry(situation: string): Entry {
    const entry: Entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: deriveTitle(situation),
      messages: [{ role: "user", content: situation }],
      summary: null,
      status: "in_progress",
    };
    setEntries((current) => [entry, ...current]);
    return entry;
  }

  function appendMessage(id: string, message: Message) {
    setEntries((current) =>
      current.map((e) => (e.id === id ? { ...e, messages: [...e.messages, message] } : e)),
    );
  }

  function completeEntry(id: string, summary: ReflectionSummary) {
    setEntries((current) =>
      current.map((e) => (e.id === id ? { ...e, summary, status: "complete" } : e)),
    );
  }

  function updateFollowUp(id: string, at: string | null, note: string | null) {
    setEntries((current) =>
      current.map((e) => {
        if (e.id !== id || !e.summary) return e;
        return {
          ...e,
          summary: {
            ...e.summary,
            trace: { ...e.summary.trace, followUpAt: at, followUpNote: note },
          },
        };
      }),
    );
  }

  function updateLongitudinalReview(id: string, patch: Partial<LongitudinalReview>) {
    setEntries((current) =>
      current.map((e) => {
        if (e.id !== id) return e;
        const prev: LongitudinalReview = e.longitudinalReview ?? {
          actualActionTaken: null,
          actualOutcome: null,
          assumptionVerdict: null,
          calibrationNote: null,
          reviewedAt: null,
        };
        const next: LongitudinalReview = {
          ...prev,
          ...patch,
          reviewedAt: patch.reviewedAt ?? new Date().toISOString(),
        };
        return { ...e, longitudinalReview: next };
      }),
    );
  }

  function clearLongitudinalReview(id: string) {
    setEntries((current) => current.map((e) => (e.id === id ? { ...e, longitudinalReview: null } : e)));
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((e) => e.id !== id));
  }

  return { startEntry, appendMessage, completeEntry, updateFollowUp, updateLongitudinalReview, clearLongitudinalReview, deleteEntry };
}
