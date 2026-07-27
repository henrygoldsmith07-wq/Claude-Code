"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import { buildBudgetsCsv, downloadCsv } from "@/lib/csvExport";
import type { Budget } from "@/lib/types";

interface Props {
  categories: string[];
  budgets: Budget[];
  spendByCategory: Record<string, number>;
  onSetBudget: (category: string, monthlyLimitCents: number) => void;
}

export default function BudgetsSection({ categories, budgets, spendByCategory, onSetBudget }: Props) {
  const [category, setCategory] = useState<string>(categories[0]);
  const [limit, setLimit] = useState("");

  function handleExport() {
    downloadCsv(buildBudgetsCsv(budgets), `budgets-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

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
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Monthly limit ($)</label>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="50.00"
            className="w-28 rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[var(--ink)] dark:hover:bg-[var(--ink-3)]"
        >
          Set budget
        </button>
        {budgets.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="text-xs text-ink3 hover:underline"
          >
            Export budgets CSV
          </button>
        )}
      </form>

      {categoriesWithSpend.length === 0 ? (
        <p className="text-sm text-ink3">No budgets set yet.</p>
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
                  <span className={over ? "text-danger" : "text-ink3"}>
                    {formatCents(spend)}
                    {limitCents > 0 && ` / ${formatCents(limitCents)}`}
                  </span>
                </div>
                {limitCents > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                    <div
                      className={`h-full ${over ? "bg-danger" : "bg-success"}`}
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
