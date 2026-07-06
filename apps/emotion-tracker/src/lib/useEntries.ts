import type { Entry, Message, ReflectionSummary } from "./types";

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

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((e) => e.id !== id));
  }

  return { startEntry, appendMessage, completeEntry, deleteEntry };
}
