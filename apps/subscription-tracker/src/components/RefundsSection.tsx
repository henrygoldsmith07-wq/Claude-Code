"use client";

import { useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import { buildRefundsCsv, downloadCsv } from "@/lib/csvExport";
import type { Refund } from "@/lib/types";

interface Props {
  refunds: Refund[];
  onAdd: (refund: Omit<Refund, "id" | "status" | "receivedAt">) => void;
  onMarkReceived: (id: string) => void;
  onDelete: (id: string) => void;
}

type Tab = "all" | "pending" | "received" | "overdue";

export default function RefundsSection({ refunds, onAdd, onMarkReceived, onDelete }: Props) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sortDesc, setSortDesc] = useState(true);

  function handleExport() {
    downloadCsv(buildRefundsCsv(refunds), `refunds-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const today = new Date().toISOString().slice(0, 10);

  function isOverdue(r: Refund) {
    return r.status === "pending" && r.expectedDate !== null && r.expectedDate < today;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!merchant.trim() || Number.isNaN(cents)) return;
    onAdd({ merchant: merchant.trim(), amountCents: cents, expectedDate: expectedDate || null });
    setMerchant("");
    setAmount("");
    setExpectedDate("");
  }

  const receivedThisYearCents = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return refunds
      .filter((r) => r.status === "received" && r.receivedAt?.startsWith(String(currentYear)))
      .reduce((sum, r) => sum + r.amountCents, 0);
  }, [refunds]);

  const filtered = useMemo(() => {
    const result = refunds.filter((r) => {
      if (tab === "all") return true;
      if (tab === "overdue") return isOverdue(r);
      return r.status === tab;
    });
    const dir = sortDesc ? -1 : 1;
    return [...result].sort((a, b) => (a.amountCents - b.amountCents) * dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refunds, tab, sortDesc]);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Merchant</label>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            required
            placeholder="Amazon"
            className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Amount ($)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            type="number"
            min="0"
            step="0.01"
            className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Expected by</label>
          <input
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            type="date"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Track
        </button>
        {refunds.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="text-xs text-zinc-500 hover:underline"
          >
            Export refunds CSV
          </button>
        )}
      </form>

      {refunds.length === 0 ? (
        <p className="text-sm text-zinc-500">No refunds tracked.</p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            Received this year: {formatCents(receivedThisYearCents)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "pending", "received", "overdue"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full border px-3 py-1 text-xs capitalize ${
                  tab === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setSortDesc((v) => !v)}
              className="ml-auto text-xs text-zinc-500 hover:underline"
            >
              Sort by amount {sortDesc ? "↓" : "↑"}
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">No refunds in this view.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((r) => {
                const overdue = isOverdue(r);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {r.merchant} · {formatCents(r.amountCents)}
                      </span>
                      <span
                        className={`text-xs ${
                          overdue
                            ? "text-red-600 dark:text-red-400"
                            : r.status === "received"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {overdue ? "overdue" : r.status}
                        {r.expectedDate && ` · expected ${r.expectedDate}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.status !== "received" && (
                        <button
                          onClick={() => onMarkReceived(r.id)}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400"
                        >
                          Mark received
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(r.id)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
