"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Subscription } from "@/lib/types";
import SubscriptionRow from "./SubscriptionRow";
import CategoryChips from "./CategoryChips";

interface Props {
  categories: string[];
  subscriptions: Subscription[];
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  showShare: boolean;
  onUpdatePrice: (id: string, newAmountCents: number) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onBulkSetActive: (category: string, active: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onMarkUsedToday: (id: string) => void;
}

type StatusFilter = "all" | "active" | "paused" | "trial" | "archived";
type SortKey = "name" | "price" | "renewal";

export default function SubscriptionsList({
  categories,
  subscriptions,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  showShare,
  onUpdatePrice,
  onToggleActive,
  onDelete,
  onBulkDelete,
  onDuplicate,
  onBulkSetActive,
  onToggleFavorite,
  onToggleArchive,
  onMarkUsedToday,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("renewal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sub of subscriptions) {
      if (sub.archived) continue;
      map[sub.category] = (map[sub.category] ?? 0) + 1;
    }
    return map;
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const result = subscriptions.filter((sub) => {
      if (statusFilter === "archived") {
        if (!sub.archived) return false;
      } else if (sub.archived) {
        return false;
      }
      if (search) {
        const term = search.toLowerCase();
        if (!sub.name.toLowerCase().includes(term) && !sub.notes.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (statusFilter === "active" && !sub.active) return false;
      if (statusFilter === "paused" && sub.active) return false;
      if (statusFilter === "trial" && !sub.isTrial) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...result].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "price") return (a.amountCents - b.amountCents) * dir;
      return a.nextRenewalDate.localeCompare(b.nextRenewalDate) * dir;
    });
    return sorted.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [subscriptions, search, categoryFilter, statusFilter, sortKey, sortDir]);

  function handleDeleteRow(sub: Subscription) {
    if (window.confirm(`Delete ${sub.name}? You can undo this right after.`)) {
      onDelete(sub.id);
    }
  }

  function toggleSelect(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    if (window.confirm(`Delete ${selected.size} selected subscription(s)?`)) {
      onBulkDelete(Array.from(selected));
      setSelected(new Set());
    }
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-ink3">No subscriptions yet. Add one above.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <CategoryChips
        countByCategory={countByCategory}
        categoryFilter={categoryFilter}
        onSelect={onCategoryFilterChange}
      />

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or notes (press /)"
          className="w-48 rounded-md border border-line px-2 py-1.5 text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="rounded-md border border-line px-2 py-1.5 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-line px-2 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="trial">Trial</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-line px-2 py-1.5 text-sm"
        >
          <option value="renewal">Sort: renewal date</option>
          <option value="name">Sort: name</option>
          <option value="price">Sort: price</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-md border border-line px-2 py-1.5 text-xs"
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
        {categoryFilter !== "all" && (
          <>
            <button
              type="button"
              onClick={() => onBulkSetActive(categoryFilter, false)}
              className="text-xs text-ink3 hover:underline"
            >
              Pause all {categoryFilter}
            </button>
            <button
              type="button"
              onClick={() => onBulkSetActive(categoryFilter, true)}
              className="text-xs text-ink3 hover:underline"
            >
              Resume all {categoryFilter}
            </button>
          </>
        )}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            className="text-xs text-danger hover:underline"
          >
            Delete {selected.size} selected
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink3">No subscriptions match your filters.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              sub={sub}
              showShare={showShare}
              selected={selected.has(sub.id)}
              onToggleSelect={toggleSelect}
              onUpdatePrice={onUpdatePrice}
              onToggleActive={onToggleActive}
              onDelete={handleDeleteRow}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              onToggleArchive={onToggleArchive}
              onMarkUsedToday={onMarkUsedToday}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
