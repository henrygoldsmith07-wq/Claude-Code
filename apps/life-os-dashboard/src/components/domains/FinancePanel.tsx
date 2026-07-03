"use client";

import { useState } from "react";
import { useFinance } from "@/lib/domains/finance";
import { formatCents } from "@/lib/money";
import { todayIso } from "@/lib/date";
import StatCard from "@/components/shared/StatCard";
import DonutChart from "@/components/shared/DonutChart";
import EmptyState from "@/components/shared/EmptyState";
import ProgressBar from "@/components/shared/ProgressBar";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import type { TxnType } from "@/lib/types";

const CATEGORIES = ["Housing", "Food", "Transport", "Health", "Fun", "Savings", "Other"];

export default function FinancePanel() {
  const { transactions, budgets, addTransaction, deleteTransaction, setBudget, addSnapshot, stats } =
    useFinance();
  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [netWorthInput, setNetWorthInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) return;
    addTransaction({ type, amountCents, category, date, note: note.trim() });
    setAmount("");
    setNote("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Track income, spending, budgets, and net worth in one place.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Income this month" value={formatCents(stats.monthIncomeCents)} accent="good" />
        <StatCard label="Spent this month" value={formatCents(stats.monthExpenseCents)} />
        <StatCard label="Savings rate" value={`${stats.savingsRatePct.toFixed(0)}%`} />
        <StatCard
          label="Net worth"
          value={stats.latestNetWorthCents !== null ? formatCents(stats.latestNetWorthCents) : "—"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Spending by category (this month)</h2>
        <DonutChart values={stats.spendByCategory} formatValue={formatCents} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Budgets</h2>
        {CATEGORIES.map((cat) => {
          const budget = budgets.find((b) => b.category === cat);
          const spend = stats.spendByCategory[cat] ?? 0;
          return (
            <div key={cat} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0">{cat}</span>
              <div className="flex-1">
                <ProgressBar
                  pct={budget ? (spend / budget.monthlyLimitCents) * 100 : 0}
                  colorClassName={budget && spend > budget.monthlyLimitCents ? "bg-rose-500" : "bg-teal-500"}
                />
              </div>
              <input
                type="number"
                placeholder="limit $"
                className={`${inputClass} w-24`}
                defaultValue={budget ? (budget.monthlyLimitCents / 100).toString() : ""}
                onBlur={(e) => {
                  const v = Math.round(parseFloat(e.target.value) * 100);
                  if (!Number.isNaN(v) && v >= 0) setBudget(cat, v);
                }}
              />
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Add transaction</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TxnType)}
            className={inputClass}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} w-28`}
            required
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recent transactions</h2>
        {transactions.length === 0 ? (
          <EmptyState message="No transactions logged yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {[...transactions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 25)
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span>
                    {t.date} · {t.category} {t.note && `· ${t.note}`}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={t.type === "income" ? "text-emerald-600" : ""}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCents(t.amountCents)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="text-zinc-400 hover:text-rose-500"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Net worth snapshot</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Current net worth ($)"
            value={netWorthInput}
            onChange={(e) => setNetWorthInput(e.target.value)}
            className={`${inputClass} w-48`}
          />
          <button
            className={buttonClass}
            onClick={() => {
              const v = Math.round(parseFloat(netWorthInput) * 100);
              if (!Number.isNaN(v)) {
                addSnapshot(v);
                setNetWorthInput("");
              }
            }}
          >
            Save today
          </button>
        </div>
      </section>
    </div>
  );
}
