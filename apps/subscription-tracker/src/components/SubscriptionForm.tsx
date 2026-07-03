"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { BillingCycle, Subscription } from "@/lib/types";

interface Props {
  onAdd: (sub: Omit<Subscription, "id" | "priceHistory" | "active">) => void;
}

export default function SubscriptionForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [nextRenewalDate, setNextRenewalDate] = useState("");
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsDate, setTrialEndsDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [splitCount, setSplitCount] = useState("1");
  const [yearlyPrice, setYearlyPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [lastUsedDate, setLastUsedDate] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!name.trim() || Number.isNaN(amountCents) || !nextRenewalDate) return;
    if (isTrial && !trialEndsDate) return;

    const splitCountNum = Math.max(1, parseInt(splitCount, 10) || 1);
    const yearlyPriceCents = yearlyPrice ? Math.round(parseFloat(yearlyPrice) * 100) : null;

    onAdd({
      name: name.trim(),
      category,
      amountCents,
      billingCycle,
      nextRenewalDate,
      isTrial,
      trialEndsDate: isTrial ? trialEndsDate : null,
      splitCount: splitCountNum,
      yearlyPriceCents: yearlyPriceCents && !Number.isNaN(yearlyPriceCents) ? yearlyPriceCents : null,
      notes: notes.trim(),
      cancelUrl: cancelUrl.trim() || null,
      lastUsedDate: lastUsedDate || null,
    });

    setName("");
    setAmount("");
    setNextRenewalDate("");
    setIsTrial(false);
    setTrialEndsDate("");
    setSplitCount("1");
    setYearlyPrice("");
    setNotes("");
    setCancelUrl("");
    setLastUsedDate("");
    setShowMore(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Netflix"
            className="w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
            placeholder="15.99"
            className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Billing cycle</label>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Next renewal</label>
          <input
            value={nextRenewalDate}
            onChange={(e) => setNextRenewalDate(e.target.value)}
            required
            type="date"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <input
            id="isTrial"
            type="checkbox"
            checked={isTrial}
            onChange={(e) => setIsTrial(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="isTrial" className="text-xs font-medium text-zinc-500">
            Free trial
          </label>
        </div>
        {isTrial && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Trial ends</label>
            <input
              value={trialEndsDate}
              onChange={(e) => setTrialEndsDate(e.target.value)}
              required
              type="date"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="pb-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {showMore ? "Fewer options" : "More options"}
        </button>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Add
        </button>
      </div>

      {showMore && (
        <div className="flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Split between (people)</label>
            <input
              value={splitCount}
              onChange={(e) => setSplitCount(e.target.value)}
              type="number"
              min="1"
              step="1"
              className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Annual plan price ($)</label>
            <input
              value={yearlyPrice}
              onChange={(e) => setYearlyPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="optional"
              className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Cancel URL</label>
            <input
              value={cancelUrl}
              onChange={(e) => setCancelUrl(e.target.value)}
              type="url"
              placeholder="https://..."
              className="w-48 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="w-48 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Last used</label>
            <input
              value={lastUsedDate}
              onChange={(e) => setLastUsedDate(e.target.value)}
              type="date"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      )}
    </form>
  );
}
