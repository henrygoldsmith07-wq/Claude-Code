"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { monthlyEquivalentCents, formatCents, daysUntil } from "@/lib/money";
import type { Budget, Refund, Subscription } from "@/lib/types";
import SubscriptionForm from "./SubscriptionForm";
import SubscriptionsList from "./SubscriptionsList";
import BudgetsSection from "./BudgetsSection";
import RefundsSection from "./RefundsSection";
import InsightsPanel from "./InsightsPanel";

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>(
    "subscriptions",
    [],
  );
  const [refunds, setRefunds] = useLocalStorage<Refund[]>("refunds", []);
  const [budgets, setBudgets] = useLocalStorage<Budget[]>("budgets", []);

  const activeSubs = subscriptions.filter((s) => s.active);

  const totalMonthlyCents = useMemo(
    () =>
      activeSubs.reduce(
        (sum, s) => sum + monthlyEquivalentCents(s.amountCents, s.billingCycle),
        0,
      ),
    [activeSubs],
  );

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of activeSubs) {
      map[s.category] = (map[s.category] ?? 0) + monthlyEquivalentCents(s.amountCents, s.billingCycle);
    }
    return map;
  }, [activeSubs]);

  const upcomingRenewals = useMemo(
    () =>
      activeSubs
        .filter((s) => {
          const days = daysUntil(s.nextRenewalDate);
          return days >= 0 && days <= 7;
        })
        .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate)),
    [activeSubs],
  );

  const pendingRefundsCents = refunds
    .filter((r) => r.status !== "received")
    .reduce((sum, r) => sum + r.amountCents, 0);

  function addSubscription(sub: Omit<Subscription, "id" | "priceHistory" | "active">) {
    setSubscriptions([
      ...subscriptions,
      { ...sub, id: crypto.randomUUID(), priceHistory: [], active: true },
    ]);
  }

  function updateSubscriptionPrice(id: string, newAmountCents: number) {
    setSubscriptions(
      subscriptions.map((s) => {
        if (s.id !== id || s.amountCents === newAmountCents) return s;
        return {
          ...s,
          amountCents: newAmountCents,
          priceHistory: [
            ...s.priceHistory,
            { amountCents: s.amountCents, recordedAt: new Date().toISOString() },
          ],
        };
      }),
    );
  }

  function toggleActive(id: string) {
    setSubscriptions(
      subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  }

  function deleteSubscription(id: string) {
    setSubscriptions(subscriptions.filter((s) => s.id !== id));
  }

  function addRefund(refund: Omit<Refund, "id" | "status">) {
    setRefunds([...refunds, { ...refund, id: crypto.randomUUID(), status: "pending" }]);
  }

  function markRefundReceived(id: string) {
    setRefunds(refunds.map((r) => (r.id === id ? { ...r, status: "received" } : r)));
  }

  function deleteRefund(id: string) {
    setRefunds(refunds.filter((r) => r.id !== id));
  }

  function setBudget(category: string, monthlyLimitCents: number) {
    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      setBudgets(
        budgets.map((b) => (b.category === category ? { ...b, monthlyLimitCents } : b)),
      );
    } else {
      setBudgets([...budgets, { id: crypto.randomUUID(), category, monthlyLimitCents }]);
    }
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Monthly subscription spend" value={formatCents(totalMonthlyCents)} />
        <StatCard label="Pending refunds" value={formatCents(pendingRefundsCents)} />
        <StatCard label="Renewing this week" value={String(upcomingRenewals.length)} />
      </section>

      {upcomingRenewals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">Renewing in the next 7 days</h2>
          <ul className="flex flex-col gap-1">
            {upcomingRenewals.map((s) => (
              <li key={s.id} className="text-sm">
                {s.name} — {formatCents(s.amountCents)} on {s.nextRenewalDate}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <SubscriptionForm onAdd={addSubscription} />
        <SubscriptionsList
          subscriptions={subscriptions}
          onUpdatePrice={updateSubscriptionPrice}
          onToggleActive={toggleActive}
          onDelete={deleteSubscription}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">AI insights</h2>
        <InsightsPanel subscriptions={subscriptions} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Budgets</h2>
        <BudgetsSection
          budgets={budgets}
          spendByCategory={spendByCategory}
          onSetBudget={setBudget}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Refunds</h2>
        <RefundsSection
          refunds={refunds}
          onAdd={addRefund}
          onMarkReceived={markRefundReceived}
          onDelete={deleteRefund}
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
