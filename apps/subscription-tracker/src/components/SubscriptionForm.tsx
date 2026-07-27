"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import type { BillingCycle, Subscription } from "@/lib/types";

interface Props {
  categories: string[];
  defaultCurrencyCode: string;
  onAdd: (sub: Omit<Subscription, "id" | "priceHistory" | "active">) => void;
}

export default function SubscriptionForm({ categories, defaultCurrencyCode, onAdd }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(categories[0]);
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
  const [paymentMethod, setPaymentMethod] = useState("");
  const [owner, setOwner] = useState("");
  const [manualCurrencyCode, setManualCurrencyCode] = useState<string | null>(null);
  const currencyCode = manualCurrencyCode ?? defaultCurrencyCode;

  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? currencyCode;

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
      isFavorite: false,
      paymentMethod: paymentMethod.trim(),
      owner: owner.trim(),
      currencyCode,
      archived: false,
      createdAt: new Date().toISOString(),
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
    setPaymentMethod("");
    setOwner("");
    setManualCurrencyCode(null);
    setShowMore(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Netflix"
            className="w-36 rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Amount ({currencySymbol})</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="15.99"
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Billing cycle</label>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink3">Next renewal</label>
          <input
            value={nextRenewalDate}
            onChange={(e) => setNextRenewalDate(e.target.value)}
            required
            type="date"
            className="rounded-md border border-line px-2 py-1.5 text-sm"
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
          <label htmlFor="isTrial" className="text-xs font-medium text-ink3">
            Free trial
          </label>
        </div>
        {isTrial && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Trial ends</label>
            <input
              value={trialEndsDate}
              onChange={(e) => setTrialEndsDate(e.target.value)}
              required
              type="date"
              className="rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="pb-1.5 text-xs font-medium text-speak hover:underline"
        >
          {showMore ? "Fewer options" : "More options"}
        </button>
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[var(--ink)] dark:hover:bg-[var(--ink-3)]"
        >
          Add
        </button>
      </div>

      {showMore && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Split between (people)</label>
            <input
              value={splitCount}
              onChange={(e) => setSplitCount(e.target.value)}
              type="number"
              min="1"
              step="1"
              className="w-20 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Annual plan price ({currencySymbol})</label>
            <input
              value={yearlyPrice}
              onChange={(e) => setYearlyPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="optional"
              className="w-28 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Cancel URL</label>
            <input
              value={cancelUrl}
              onChange={(e) => setCancelUrl(e.target.value)}
              type="url"
              placeholder="https://..."
              className="w-48 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="w-48 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Last used</label>
            <input
              value={lastUsedDate}
              onChange={(e) => setLastUsedDate(e.target.value)}
              type="date"
              className="rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Payment method</label>
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Visa 4242"
              className="w-32 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Owner</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="optional"
              className="w-28 rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink3">Billed in</label>
            <select
              value={currencyCode}
              onChange={(e) => setManualCurrencyCode(e.target.value)}
              className="rounded-md border border-line px-2 py-1.5 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </form>
  );
}
