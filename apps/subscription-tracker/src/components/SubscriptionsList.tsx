"use client";

import { useMemo, useState } from "react";
import { formatCents, daysUntil, yourShareCents, annualSwitchSavingsCents } from "@/lib/money";
import { CATEGORIES } from "@/lib/categories";
import type { Subscription } from "@/lib/types";

interface Props {
  subscriptions: Subscription[];
  onUpdatePrice: (id: string, newAmountCents: number) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
}

type StatusFilter = "all" | "active" | "paused" | "trial";

export default function SubscriptionsList({
  subscriptions,
  onUpdatePrice,
  onToggleActive,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (search && !sub.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (statusFilter === "active" && !sub.active) return false;
      if (statusFilter === "paused" && sub.active) return false;
      if (statusFilter === "trial" && !sub.isTrial) return false;
      return true;
    });
  }, [subscriptions, search, categoryFilter, statusFilter]);

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

  if (subscriptions.length === 0) {
    return <p className="text-sm text-zinc-500">No subscriptions yet. Add one above.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="trial">Trial</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No subscriptions match your filters.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((sub) => {
            const days = daysUntil(sub.nextRenewalDate);
            const hadPriceHike = sub.priceHistory.some((h) => h.amountCents < sub.amountCents);
            const shareCents = yourShareCents(sub.amountCents, sub.splitCount);
            const savingsCents = annualSwitchSavingsCents(
              sub.amountCents,
              sub.billingCycle,
              sub.yearlyPriceCents,
            );
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
                    )}{" "}
                    {sub.splitCount > 1 && (
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-normal text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        split {sub.splitCount} ways · your share {formatCents(shareCents)}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {sub.category} · {sub.billingCycle} ·{" "}
                    {days >= 0 ? `renews in ${days}d` : `renewal overdue`}
                  </span>
                  {savingsCents > 0 && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Save {formatCents(savingsCents)}/yr switching to the annual plan
                    </span>
                  )}
                  {sub.notes && <span className="text-xs text-zinc-500">{sub.notes}</span>}
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
                  {sub.cancelUrl && (
                    <a
                      href={sub.cancelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:underline"
                    >
                      Cancel ↗
                    </a>
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
      )}
    </div>
  );
}
