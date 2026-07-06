"use client";

import { useCallback, useState } from "react";
import {
  addSubtaskAction,
  addTaskAction,
  addTaskLinkAction,
  deleteTaskAction,
  setTaskStatusAction,
  toggleSubtaskAction,
} from "./supabase/actions";
import type { Task, TaskStatus } from "./types";

export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initial);

  const addTask = useCallback(async (title: string) => {
    const tempId = `local-${Date.now()}`;
    const task: Task = {
      id: tempId,
      title,
      status: "todo",
      subtasks: [],
      links: [],
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [task, ...prev]);
    try {
      const id = await addTaskAction(title);
      setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id } : t)));
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    void deleteTaskAction(id);
  }, []);

  // Optimistic: flip the card's column immediately, then persist.
  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    void setTaskStatusAction(id, status);
  }, []);

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const tempId = `local-${Date.now()}`;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: tempId, title, done: false }] } : t,
      ),
    );
    try {
      const id = await addSubtaskAction(taskId, title);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.map((s) => (s.id === tempId ? { ...s, id } : s)) }
            : t,
        ),
      );
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== tempId) } : t,
        ),
      );
    }
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    let nextDone = false;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) => {
            if (s.id !== subtaskId) return s;
            nextDone = !s.done;
            return { ...s, done: nextDone };
          }),
        };
      }),
    );
    void toggleSubtaskAction(subtaskId, nextDone);
  }, []);

  const addLink = useCallback((taskId: string, link: string) => {
    let nextLinks: string[] = [];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        nextLinks = [...t.links, link];
        return { ...t, links: nextLinks };
      }),
    );
    void addTaskLinkAction(taskId, nextLinks);
  }, []);

  return { tasks, addTask, deleteTask, setTaskStatus, addSubtask, toggleSubtask, addLink };
}
