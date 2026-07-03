"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import type { LearningItem, LearningStatus, LearningType } from "@/lib/types";

export function useSelfImprovement() {
  const [items, setItems] = useLocalStorage<LearningItem[]>("selfImprovement.items", []);

  function addItem(type: LearningType, title: string) {
    setItems([
      ...items,
      { id: crypto.randomUUID(), type, title, status: "planned", progressPct: 0, rating: null, notes: "" },
    ]);
  }
  function deleteItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function updateProgress(id: string, progressPct: number) {
    const status: LearningStatus = progressPct >= 100 ? "done" : progressPct > 0 ? "in_progress" : "planned";
    setItems(items.map((i) => (i.id === id ? { ...i, progressPct, status } : i)));
  }
  function rateItem(id: string, rating: number) {
    setItems(items.map((i) => (i.id === id ? { ...i, rating } : i)));
  }

  const inProgress = items.filter((i) => i.status === "in_progress");
  const done = items.filter((i) => i.status === "done");
  const planned = items.filter((i) => i.status === "planned");

  return {
    items,
    addItem,
    deleteItem,
    updateProgress,
    rateItem,
    stats: { inProgress, done, planned },
  };
}
