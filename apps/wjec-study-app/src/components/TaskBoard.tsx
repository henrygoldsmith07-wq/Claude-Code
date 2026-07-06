"use client";

import { useState } from "react";
import { useTasks } from "@/lib/useTasks";
import type { Task, TaskStatus } from "@/lib/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "doing", label: "Doing" },
  { status: "done", label: "Done" },
];

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddLink: (taskId: string, link: string) => void;
}

function TaskCard({ task, onDelete, onAddSubtask, onToggleSubtask, onAddLink }: TaskCardProps) {
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{task.title}</p>
        <button
          onClick={() => onDelete(task.id)}
          aria-label={`Delete task ${task.title}`}
          className="text-zinc-400 hover:text-red-600"
        >
          ×
        </button>
      </div>

      {task.subtasks.map((s) => (
        <label key={s.id} className="flex items-center gap-1.5">
          <input type="checkbox" checked={s.done} onChange={() => onToggleSubtask(task.id, s.id)} />
          <span className={s.done ? "text-zinc-400 line-through" : ""}>{s.title}</span>
        </label>
      ))}
      <input
        value={subtaskDraft}
        onChange={(e) => setSubtaskDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && subtaskDraft.trim()) {
            onAddSubtask(task.id, subtaskDraft.trim());
            setSubtaskDraft("");
          }
        }}
        aria-label="Add a subtask"
        placeholder="+ subtask"
        className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900"
      />

      {task.links.map((link, i) => (
        <a
          key={i}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-violet-600 hover:underline dark:text-violet-400"
        >
          {link}
        </a>
      ))}
      <input
        value={linkDraft}
        onChange={(e) => setLinkDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && linkDraft.trim()) {
            onAddLink(task.id, linkDraft.trim());
            setLinkDraft("");
          }
        }}
        aria-label="Attach a link"
        placeholder="+ attach a link"
        className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900"
      />
    </div>
  );
}

export default function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, addTask, deleteTask, setTaskStatus, addSubtask, toggleSubtask, addLink } =
    useTasks(initialTasks);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              addTask(draft.trim());
              setDraft("");
            }
          }}
          aria-label="New task"
          placeholder="New task…"
          className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              addTask(draft.trim());
              setDraft("");
            }
          }}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
        >
          Add
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) setTaskStatus(taskId, col.status);
            }}
            className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {col.label}
            </p>
            {tasks
              .filter((t) => t.status === col.status)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={deleteTask}
                  onAddSubtask={addSubtask}
                  onToggleSubtask={toggleSubtask}
                  onAddLink={addLink}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
