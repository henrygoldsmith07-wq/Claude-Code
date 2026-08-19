"use client";

import { useState } from "react";
import { HabitForm } from "./HabitForm";
import type { HabitInput, HabitView } from "@/lib/supabase";

interface ManageListProps {
  active: readonly HabitView[];
  archived: readonly HabitView[];
  addHabit: (input: HabitInput) => Promise<void>;
  updateHabit: (id: string, input: HabitInput) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
}

export function ManageList({ active, archived, addHabit, updateHabit, setArchived, removeHabit }: ManageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = active.find((view) => view.id === editingId) ?? archived.find((view) => view.id === editingId);

  return (
    <div className="space-y-6">
      <section aria-labelledby="new-habit-title">
        <h2 id="new-habit-title" className="mb-3 text-lg font-semibold">
          {editing ? "Edit habit" : "Add a habit"}
        </h2>
        <HabitForm
          key={editing?.id ?? "new"}
          initial={editing ? { name: editing.name, targetPerWeek: editing.targetPerWeek, colour: editing.colour } : undefined}
          submitLabel={editing ? "Save changes" : "Add habit"}
          onSubmit={(input) => {
            if (editing) void updateHabit(editing.id, input);
            else void addHabit(input);
            setEditingId(null);
          }}
          onCancel={editing ? () => setEditingId(null) : undefined}
        />
      </section>

      <section aria-labelledby="active-habits-title">
        <h2 id="active-habits-title" className="mb-3 text-lg font-semibold">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink2">
            Nothing active. Add one above, or restore an archived habit below.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((view) => (
              <li key={view.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: view.colour }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{view.name}</span>
                <span className="text-xs text-ink3">
                  {view.targetPerWeek}d/wk · best {view.best}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(view.id)}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink2 hover:text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void setArchived(view.id, true)}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink3 hover:text-ink"
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-habits-title">
          <h2 id="archived-habits-title" className="mb-3 text-lg font-semibold">
            Archived ({archived.length})
          </h2>
          <ul className="space-y-2">
            {archived.map((view) => (
              <li key={view.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 opacity-70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: view.colour }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm">{view.name}</span>
                <button
                  type="button"
                  onClick={() => void setArchived(view.id, false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink2 hover:text-ink"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${view.name}" and all of its check-ins?`)) {
                      void removeHabit(view.id);
                    }
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-danger hover:opacity-80"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
