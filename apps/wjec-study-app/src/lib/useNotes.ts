"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Note, SubjectId } from "./types";

export function useNotes() {
  const [notes, setNotes] = useLocalStorage<Note[]>("wjec-notes", []);

  const addNote = useCallback(
    (input: {
      title: string;
      body: string;
      sketchDataUrl: string | null;
      audioDataUrl: string | null;
      tags: string[];
      subjectId: SubjectId | null;
      topicId: string | null;
    }) => {
      const now = new Date().toISOString();
      const note: Note = {
        id: `note-${Date.now()}`,
        title: input.title,
        body: input.body,
        sketchDataUrl: input.sketchDataUrl,
        audioDataUrl: input.audioDataUrl,
        tags: input.tags,
        subjectId: input.subjectId,
        topicId: input.topicId,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [note, ...prev]);
      return note;
    },
    [setNotes],
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [setNotes],
  );

  return { notes, addNote, deleteNote };
}
