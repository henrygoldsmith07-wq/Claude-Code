"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { todayIso } from "@/lib/date";
import type { FinanceBudget, NetWorthSnapshot, Transaction } from "@/lib/types";

export function useFinance() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>("finance.transactions", []);
  const [budgets, setBudgets] = useLocalStorage<FinanceBudget[]>("finance.budgets", []);
  const [snapshots, setSnapshots] = useLocalStorage<NetWorthSnapshot[]>("finance.netWorth", []);

  function addTransaction(t: Omit<Transaction, "id">) {
    setTransactions([...transactions, { ...t, id: crypto.randomUUID() }]);
  }
  function deleteTransaction(id: string) {
    setTransactions(transactions.filter((t) => t.id !== id));
  }

  function setBudget(category: string, monthlyLimitCents: number) {
    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      setBudgets(budgets.map((b) => (b.category === category ? { ...b, monthlyLimitCents } : b)));
    } else {
      setBudgets([...budgets, { id: crypto.randomUUID(), category, monthlyLimitCents }]);
    }
  }
  function deleteBudget(id: string) {
    setBudgets(budgets.filter((b) => b.id !== id));
  }

  function addSnapshot(amountCents: number, date = todayIso()) {
    setSnapshots([...snapshots.filter((s) => s.date !== date), { id: crypto.randomUUID(), date, amountCents }]);
  }
  function deleteSnapshot(id: string) {
    setSnapshots(snapshots.filter((s) => s.id !== id));
  }

  const monthKey = todayIso().slice(0, 7);
  const monthTxns = transactions.filter((t) => t.date.startsWith(monthKey));
  const monthIncomeCents = monthTxns
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amountCents, 0);
  const monthExpenseCents = monthTxns
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amountCents, 0);
  const savingsRatePct =
    monthIncomeCents > 0 ? ((monthIncomeCents - monthExpenseCents) / monthIncomeCents) * 100 : 0;

  const spendByCategory: Record<string, number> = {};
  for (const t of monthTxns) {
    if (t.type !== "expense") continue;
    spendByCategory[t.category] = (spendByCategory[t.category] ?? 0) + t.amountCents;
  }

  const latestNetWorthCents = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0]?.amountCents ?? null;

  return {
    transactions,
    budgets,
    snapshots,
    addTransaction,
    deleteTransaction,
    setBudget,
    deleteBudget,
    addSnapshot,
    deleteSnapshot,
    stats: {
      monthIncomeCents,
      monthExpenseCents,
      savingsRatePct,
      spendByCategory,
      latestNetWorthCents,
    },
  };
}
