"use client";

import { useState } from "react";
import { formatCents, daysUntil } from "@/lib/money";
import type { Subscription } from "@/lib/types";

interface Props {
  subscriptions: Subscription[];
  onUpdatePrice: (id: string, newAmountCents: number) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SubscriptionsList({
  subscriptions,
  onUpdatePrice,
  onToggleActive,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (subscriptions.length === 0) {
    return <p className="text-sm text-zinc-500">No subscriptions yet. Add one above.</p>;
  }

  function startEdit(sub: Subscription) {
    setEditingId(sub.id);
    setEditValue((sub.amountCents / 100).toFixed(2));
  }

  function submitEdit(id: string) {
    const cents = Math.round(parseFloat(editValue) * 100);
    if (!Number.isNaN(cents)) {
      onUpdatePrice(id, cents);
    }
    setEditingId(null);
  }

  return (
    <ul className="flex flex-col gap-2">
      {subscriptions.map((sub) => {
        const days = daysUntil(sub.nextRenewalDate);
        const hadPriceHike = sub.priceHistory.some((h) => h.amountCents < sub.amountCents);
        return (
          <li
            key={sub.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
              sub.active
                ? "border-zinc-200 dark:border-zinc-800"
                : "border-zinc-200 opacity-50 dark:border-zinc-800"
            }`}
          >
            <div className="flex flex-col">
              <span className="font-medium">
                {sub.name}{" "}
                {hadPriceHike && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    price hike
                  </span>
                )}{" "}
                {sub.isTrial && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-normal text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    trial{sub.trialEndsDate ? ` ends ${sub.trialEndsDate}` : ""}
                  </span>
                )}
              </span>
              <span className="text-xs text-zinc-500">
                {sub.category} · {sub.billingCycle} ·{" "}
                {days >= 0 ? `renews in ${days}d` : `renewal overdue`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {editingId === sub.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    type="number"
                    step="0.01"
                    className="w-20 rounded border border-zinc-300 px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    onClick={() => submitEdit(sub.id)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(sub)}
                  className="font-mono text-sm hover:underline"
                >
                  {formatCents(sub.amountCents)}
                </button>
              )}
              <button
                onClick={() => onToggleActive(sub.id)}
                className="text-xs text-zinc-500 hover:underline"
              >
                {sub.active ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => onDelete(sub.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
