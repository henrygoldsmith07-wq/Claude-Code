"use client";

import { useState } from "react";

interface Props {
  customCategories: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export default function CategoryManager({ customCategories, onAdd, onRemove }: Props) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-xs">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New category name"
        className="w-40 rounded-md border border-line px-2 py-1"
      />
      <button
        type="submit"
        className="rounded-full border border-line px-3 py-1 hover:bg-surface2 dark:hover:bg-surface"
      >
        Add category
      </button>
      {customCategories.map((c) => (
        <span key={c} className="flex items-center gap-1 rounded-full border border-line px-2 py-1">
          {c}
          <button onClick={() => onRemove(c)} className="text-ink3 hover:text-ink2">
            ✕
          </button>
        </span>
      ))}
    </form>
  );
}
