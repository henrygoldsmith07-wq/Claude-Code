"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatCents } from "@/lib/money";
import type { Budget } from "@/lib/types";

interface Props {
  budgets: Budget[];
  spendByCategory: Record<string, number>;
  onSetBudget: (category: string, monthlyLimitCents: number) => void;
}

export default function BudgetsSection({ budgets, spendByCategory, onSetBudget }: Props) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [limit, setLimit] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(limit) * 100);
    if (Number.isNaN(cents)) return;
    onSetBudget(category, cents);
    setLimit("");
  }

  const categoriesWithSpend = Array.from(
    new Set([...budgets.map((b) => b.category), ...Object.keys(spendByCategory)]),
  );

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Monthly limit ($)</label>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="50.00"
            className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Set budget
        </button>
      </form>

      {categoriesWithSpend.length === 0 ? (
        <p className="text-sm text-zinc-500">No budgets set yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {categoriesWithSpend.map((cat) => {
            const budget = budgets.find((b) => b.category === cat);
            const spend = spendByCategory[cat] ?? 0;
            const limitCents = budget?.monthlyLimitCents ?? 0;
            const pct = limitCents > 0 ? Math.min(100, (spend / limitCents) * 100) : 0;
            const over = limitCents > 0 && spend > limitCents;
            return (
              <li key={cat} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{cat}</span>
                  <span className={over ? "text-red-600 dark:text-red-400" : "text-zinc-500"}>
                    {formatCents(spend)}
                    {limitCents > 0 && ` / ${formatCents(limitCents)}`}
                  </span>
                </div>
                {limitCents > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className={`h-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
