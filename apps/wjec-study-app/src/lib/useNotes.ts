"use client";

import { useCallback, useState } from "react";
import { addNoteAction, deleteNoteAction } from "./supabase/actions";
import type { Note, SubjectId } from "./types";

export function useNotes(initial: Note[]) {
  const [notes, setNotes] = useState<Note[]>(initial);

  const addNote = useCallback(
    async (input: {
      title: string;
      body: string;
      sketchDataUrl: string | null;
      audioDataUrl: string | null;
      tags: string[];
      subjectId: SubjectId | null;
      topicId: string | null;
    }) => {
      const now = new Date().toISOString();
      const tempId = `local-${Date.now()}`;
      const note: Note = {
        id: tempId,
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
      try {
        const id = await addNoteAction(input);
        setNotes((prev) => prev.map((n) => (n.id === tempId ? { ...n, id } : n)));
      } catch {
        setNotes((prev) => prev.filter((n) => n.id !== tempId));
      }
      return note;
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    void deleteNoteAction(id);
  }, []);

  return { notes, addNote, deleteNote };
}
