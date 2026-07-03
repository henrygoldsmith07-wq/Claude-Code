"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatCents,
  daysUntil,
  daysSince,
  yourShareCents,
  annualSwitchSavingsCents,
} from "@/lib/money";
import { CATEGORIES } from "@/lib/categories";
import type { Subscription } from "@/lib/types";

interface Props {
  subscriptions: Subscription[];
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  showShare: boolean;
  onUpdatePrice: (id: string, newAmountCents: number) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBulkSetActive: (category: string, active: boolean) => void;
}

type StatusFilter = "all" | "active" | "paused" | "trial";
type SortKey = "name" | "price" | "renewal";

export default function SubscriptionsList({
  subscriptions,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  showShare,
  onUpdatePrice,
  onToggleActive,
  onDelete,
  onDuplicate,
  onBulkSetActive,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("renewal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const filtered = useMemo(() => {
    const result = subscriptions.filter((sub) => {
      if (search && !sub.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (statusFilter === "active" && !sub.active) return false;
      if (statusFilter === "paused" && sub.active) return false;
      if (statusFilter === "trial" && !sub.isTrial) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "price") return (a.amountCents - b.amountCents) * dir;
      return a.nextRenewalDate.localeCompare(b.nextRenewalDate) * dir;
    });
  }, [subscriptions, search, categoryFilter, statusFilter, sortKey, sortDir]);

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

  function handleDelete(sub: Subscription) {
    if (window.confirm(`Delete ${sub.name}? You can undo this right after.`)) {
      onDelete(sub.id);
    }
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-zinc-500">No subscriptions yet. Add one above.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name (press /)"
          className="w-44 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
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
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="renewal">Sort: renewal date</option>
          <option value="name">Sort: name</option>
          <option value="price">Sort: price</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700"
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
        {categoryFilter !== "all" && (
          <>
            <button
              type="button"
              onClick={() => onBulkSetActive(categoryFilter, false)}
              className="text-xs text-zinc-500 hover:underline"
            >
              Pause all {categoryFilter}
            </button>
            <button
              type="button"
              onClick={() => onBulkSetActive(categoryFilter, true)}
              className="text-xs text-zinc-500 hover:underline"
            >
              Resume all {categoryFilter}
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No subscriptions match your filters.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((sub) => {
            const days = daysUntil(sub.nextRenewalDate);
            const hadPriceHike = sub.priceHistory.some((h) => h.amountCents < sub.amountCents);
            const shareCents = yourShareCents(sub.amountCents, sub.splitCount);
            const displayCents = showShare ? shareCents : sub.amountCents;
            const savingsCents = annualSwitchSavingsCents(
              sub.amountCents,
              sub.billingCycle,
              sub.yearlyPriceCents,
            );
            const idle = sub.lastUsedDate !== null && daysSince(sub.lastUsedDate) >= 30;
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
                    )}{" "}
                    {idle && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-normal text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        idle 30+ days
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
                      {formatCents(displayCents)}
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
                    onClick={() => onDuplicate(sub.id)}
                    className="text-xs text-zinc-500 hover:underline"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => onToggleActive(sub.id)}
                    className="text-xs text-zinc-500 hover:underline"
                  >
                    {sub.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(sub)}
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
