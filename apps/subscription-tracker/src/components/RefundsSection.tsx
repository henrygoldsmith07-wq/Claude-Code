"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { Refund } from "@/lib/types";

interface Props {
  refunds: Refund[];
  onAdd: (refund: Omit<Refund, "id" | "status">) => void;
  onMarkReceived: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function RefundsSection({ refunds, onAdd, onMarkReceived, onDelete }: Props) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!merchant.trim() || Number.isNaN(cents)) return;
    onAdd({ merchant: merchant.trim(), amountCents: cents, expectedDate: expectedDate || null });
    setMerchant("");
    setAmount("");
    setExpectedDate("");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
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
      </form>

      {refunds.length === 0 ? (
        <p className="text-sm text-zinc-500">No refunds tracked.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {refunds.map((r) => {
            const overdue = r.status === "pending" && r.expectedDate !== null && r.expectedDate < today;
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
    </div>
  );
}
