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
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{task.title}</p>
        <button
          onClick={() => onDelete(task.id)}
          aria-label={`Delete task ${task.title}`}
          className="text-ink3 hover:text-danger"
        >
          ×
        </button>
      </div>

      {task.subtasks.map((s) => (
        <label key={s.id} className="flex items-center gap-1.5">
          <input type="checkbox" checked={s.done} onChange={() => onToggleSubtask(task.id, s.id)} />
          <span className={s.done ? "text-ink3 line-through" : ""}>{s.title}</span>
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
        className="rounded border border-line px-2 py-1"
      />

      {task.links.map((link, i) => (
        <a
          key={i}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-speak hover:underline"
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
        className="rounded border border-line px-2 py-1"
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
          className="flex-1 rounded-full border border-line px-4 py-2 text-sm"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              addTask(draft.trim());
              setDraft("");
            }
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm text-onaccent"
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
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink3">
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
