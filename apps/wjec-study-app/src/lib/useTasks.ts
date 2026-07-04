"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Task, TaskStatus } from "./types";

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("wjec-tasks", []);

  const addTask = useCallback(
    (title: string) => {
      const task: Task = {
        id: `task-${Date.now()}`,
        title,
        status: "todo",
        subtasks: [],
        links: [],
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [task, ...prev]);
    },
    [setTasks],
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [setTasks],
  );

  const setTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    },
    [setTasks],
  );

  const addSubtask = useCallback(
    (taskId: string, title: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...t.subtasks, { id: `sub-${Date.now()}`, title, done: false }] }
            : t,
        ),
      );
    },
    [setTasks],
  );

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
              }
            : t,
        ),
      );
    },
    [setTasks],
  );

  const addLink = useCallback(
    (taskId: string, link: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, links: [...t.links, link] } : t)),
      );
    },
    [setTasks],
  );

  return { tasks, addTask, deleteTask, setTaskStatus, addSubtask, toggleSubtask, addLink };
}
