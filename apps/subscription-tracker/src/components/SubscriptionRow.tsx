"use client";

import { useState } from "react";
import {
  formatCents,
  daysUntil,
  daysSince,
  yourShareCents,
  annualSwitchSavingsCents,
} from "@/lib/money";
import type { Subscription } from "@/lib/types";

interface Props {
  sub: Subscription;
  showShare: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdatePrice: (id: string, newAmountCents: number) => void;
  onToggleActive: (id: string) => void;
  onDelete: (sub: Subscription) => void;
  onDuplicate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onMarkUsedToday: (id: string) => void;
}

export default function SubscriptionRow({
  sub,
  showShare,
  selected,
  onToggleSelect,
  onUpdatePrice,
  onToggleActive,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onToggleArchive,
  onMarkUsedToday,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState((sub.amountCents / 100).toFixed(2));

  const days = daysUntil(sub.nextRenewalDate);
  const hadPriceHike = sub.priceHistory.some((h) => h.amountCents < sub.amountCents);
  const shareCents = yourShareCents(sub.amountCents, sub.splitCount);
  const displayCents = showShare ? shareCents : sub.amountCents;
  const savingsCents = annualSwitchSavingsCents(sub.amountCents, sub.billingCycle, sub.yearlyPriceCents);
  const idle = sub.lastUsedDate !== null && daysSince(sub.lastUsedDate) >= 30;
  const renewalColor = days <= 3 ? "text-red-600 dark:text-red-400" : days <= 7 ? "text-amber-600 dark:text-amber-400" : "";

  function submitEdit() {
    const cents = Math.round(parseFloat(editValue) * 100);
    if (!Number.isNaN(cents)) onUpdatePrice(sub.id, cents);
    setEditing(false);
  }

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
        sub.active ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 opacity-50 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(sub.id)}
          className="mt-1 h-3.5 w-3.5"
        />
        <div className="flex flex-col">
          <span className="font-medium">
            <button onClick={() => onToggleFavorite(sub.id)} className="mr-1" title="Favorite">
              {sub.isFavorite ? "★" : "☆"}
            </button>
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
                split {sub.splitCount} ways · your share {formatCents(shareCents, sub.currencyCode)}
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
            <span className={renewalColor}>{days >= 0 ? `renews in ${days}d` : "renewal overdue"}</span>
            {sub.paymentMethod && ` · ${sub.paymentMethod}`}
            {sub.owner && ` · ${sub.owner}`}
          </span>
          {savingsCents > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Save {formatCents(savingsCents, sub.currencyCode)}/yr switching to the annual plan
            </span>
          )}
          {sub.notes && <span className="text-xs text-zinc-500">{sub.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              type="number"
              step="0.01"
              className="w-20 rounded border border-zinc-300 px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button onClick={submitEdit} className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Save
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="font-mono text-sm hover:underline">
            {formatCents(displayCents, sub.currencyCode)}
          </button>
        )}
        {sub.cancelUrl && (
          <a href={sub.cancelUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:underline">
            Cancel ↗
          </a>
        )}
        <button onClick={() => onMarkUsedToday(sub.id)} className="text-xs text-zinc-500 hover:underline">
          Used today
        </button>
        <button onClick={() => onDuplicate(sub.id)} className="text-xs text-zinc-500 hover:underline">
          Duplicate
        </button>
        <button onClick={() => onToggleActive(sub.id)} className="text-xs text-zinc-500 hover:underline">
          {sub.active ? "Pause" : "Resume"}
        </button>
        <button onClick={() => onToggleArchive(sub.id)} className="text-xs text-zinc-500 hover:underline">
          {sub.archived ? "Unarchive" : "Archive"}
        </button>
        <button onClick={() => onDelete(sub)} className="text-xs text-red-600 hover:underline dark:text-red-400">
          Delete
        </button>
      </div>
    </li>
  );
}
