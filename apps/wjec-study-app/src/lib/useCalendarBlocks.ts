"use client";

import { useCallback, useState } from "react";
import {
  addCalendarBlockAction,
  deleteCalendarBlockAction,
  moveCalendarBlockAction,
} from "./supabase/actions";
import type { CalendarBlock, SubjectId } from "./types";

export function useCalendarBlocks(initial: CalendarBlock[]) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>(initial);

  const addBlock = useCallback(
    async (input: {
      day: string;
      startHour: number;
      durationHours: number;
      title: string;
      subjectId: SubjectId | null;
      topicId: string | null;
    }) => {
      const tempId = `local-${Date.now()}`;
      const block: CalendarBlock = { id: tempId, ...input };
      setBlocks((prev) => [...prev, block]);
      try {
        const id = await addCalendarBlockAction(input);
        setBlocks((prev) => prev.map((b) => (b.id === tempId ? { ...b, id } : b)));
      } catch {
        setBlocks((prev) => prev.filter((b) => b.id !== tempId));
      }
    },
    [],
  );

  const moveBlock = useCallback((id: string, day: string, startHour: number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, day, startHour } : b)));
    void moveCalendarBlockAction(id, day, startHour);
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    void deleteCalendarBlockAction(id);
  }, []);

  return { blocks, addBlock, moveBlock, deleteBlock };
}
