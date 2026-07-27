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
          <label className="text-xs font-medium text-ink3">Merchant</label>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            required
            placeholder="Amazon"
            className="w-32 rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Amount ($)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            type="number"
            min="0"
            step="0.01"
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Expected by</label>
          <input
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            type="date"
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[var(--ink)] dark:hover:bg-[var(--ink-3)]"
        >
          Track
        </button>
        {refunds.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="text-xs text-ink3 hover:underline"
          >
            Export refunds CSV
          </button>
        )}
      </form>

      {refunds.length === 0 ? (
        <p className="text-sm text-ink3">No refunds tracked.</p>
      ) : (
        <>
          <p className="text-xs text-ink3">
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
                    : "border-line text-ink2"
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setSortDesc((v) => !v)}
              className="ml-auto text-xs text-ink3 hover:underline"
            >
              Sort by amount {sortDesc ? "↓" : "↑"}
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink3">No refunds in this view.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((r) => {
                const overdue = isOverdue(r);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {r.merchant} · {formatCents(r.amountCents)}
                      </span>
                      <span
                        className={`text-xs ${
                          overdue
                            ? "text-danger"
                            : r.status === "received"
                              ? "text-success"
                              : "text-ink3"
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
                          className="text-xs font-medium text-speak"
                        >
                          Mark received
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(r.id)}
                        className="text-xs text-danger hover:underline"
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
