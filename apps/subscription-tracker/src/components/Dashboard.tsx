"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTheme } from "@/lib/useTheme";
import {
  monthlyEquivalentCents,
  annualEquivalentCents,
  yourShareCents,
  formatCents,
  daysUntil,
} from "@/lib/money";
import { buildCsv, downloadCsv } from "@/lib/csvExport";
import { parseSubscriptionsCsv } from "@/lib/csvImport";
import { buildBackup, downloadJson, parseBackup } from "@/lib/backup";
import type { Budget, CancellationLogEntry, Refund, Subscription } from "@/lib/types";
import SubscriptionForm from "./SubscriptionForm";
import SubscriptionsList from "./SubscriptionsList";
import BudgetsSection from "./BudgetsSection";
import RefundsSection from "./RefundsSection";
import InsightsPanel from "./InsightsPanel";
import CategoryChart from "./CategoryChart";
import SettingsBar from "./SettingsBar";
import Toast from "./Toast";

interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>(
    "subscriptions",
    [],
  );
  const [refunds, setRefunds] = useLocalStorage<Refund[]>("refunds", []);
  const [budgets, setBudgets] = useLocalStorage<Budget[]>("budgets", []);
  const [cancellationLog, setCancellationLog] = useLocalStorage<CancellationLogEntry[]>(
    "cancellationLog",
    [],
  );
  const [showShare, setShowShare] = useLocalStorage<boolean>("showShare", false);

  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toast, setToast] = useState<ToastState | null>(null);

  const activeSubs = subscriptions.filter((s) => s.active);

  const totalMonthlyCents = useMemo(
    () =>
      activeSubs.reduce(
        (sum, s) =>
          sum +
          monthlyEquivalentCents(yourShareCents(s.amountCents, s.splitCount), s.billingCycle),
        0,
      ),
    [activeSubs],
  );

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of activeSubs) {
      const shareCents = yourShareCents(s.amountCents, s.splitCount);
      map[s.category] = (map[s.category] ?? 0) + monthlyEquivalentCents(shareCents, s.billingCycle);
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

  const totalAnnualCents = totalMonthlyCents * 12;
  const totalBudgetCents = budgets.reduce((sum, b) => sum + b.monthlyLimitCents, 0);

  const topExpenseSubs = useMemo(
    () =>
      [...activeSubs]
        .sort(
          (a, b) =>
            annualEquivalentCents(yourShareCents(b.amountCents, b.splitCount), b.billingCycle) -
            annualEquivalentCents(yourShareCents(a.amountCents, a.splitCount), a.billingCycle),
        )
        .slice(0, 3),
    [activeSubs],
  );

  const trialsEndingSoon = useMemo(
    () =>
      activeSubs
        .filter((s) => s.isTrial && s.trialEndsDate)
        .filter((s) => {
          const days = daysUntil(s.trialEndsDate as string);
          return days >= 0 && days <= 7;
        })
        .sort((a, b) => (a.trialEndsDate as string).localeCompare(b.trialEndsDate as string)),
    [activeSubs],
  );

  const lifetimeSavedFromCancellations = cancellationLog.reduce(
    (sum, entry) => sum + entry.monthlyEquivalentCentsAtCancellation * 12,
    0,
  );

  const priceHikeImpactCents = useMemo(
    () =>
      subscriptions.reduce((sum, s) => {
        if (s.priceHistory.length === 0) return sum;
        const oldest = s.priceHistory[0].amountCents;
        const increase = annualEquivalentCents(s.amountCents, s.billingCycle) -
          annualEquivalentCents(oldest, s.billingCycle);
        return sum + Math.max(0, increase);
      }, 0),
    [subscriptions],
  );

  function handleExportCsv() {
    const csv = buildCsv(subscriptions, budgets, refunds);
    downloadCsv(csv, `subscription-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleExportBackup() {
    const backup = buildBackup(subscriptions, budgets, refunds, cancellationLog);
    downloadJson(backup, `subscription-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  function handleImportBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBackup(String(reader.result));
        setSubscriptions(backup.subscriptions);
        setBudgets(backup.budgets);
        setRefunds(backup.refunds);
        setCancellationLog(backup.cancellationLog);
        setToast({ message: "Backup restored" });
      } catch (err) {
        setToast({ message: err instanceof Error ? err.message : "Failed to restore backup" });
      }
    };
    reader.readAsText(file);
  }

  function handleImportCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseSubscriptionsCsv(String(reader.result));
        setSubscriptions([
          ...subscriptions,
          ...imported.map((sub) => ({ ...sub, id: crypto.randomUUID(), priceHistory: [] })),
        ]);
        setToast({ message: `Imported ${imported.length} subscription(s)` });
      } catch (err) {
        setToast({ message: err instanceof Error ? err.message : "Failed to import CSV" });
      }
    };
    reader.readAsText(file);
  }

  function handleCopySummary() {
    const lines = [
      "Subscription Tracker summary",
      `Your monthly spend: ${formatCents(totalMonthlyCents)}`,
      `Your projected annual cost: ${formatCents(totalAnnualCents)}`,
      `Pending refunds: ${formatCents(pendingRefundsCents)}`,
      `Renewing this week: ${upcomingRenewals.length}`,
      `Lifetime saved from cancellations: ${formatCents(lifetimeSavedFromCancellations)}`,
      "",
      "Top spend by category:",
      ...Object.entries(spendByCategory).map(([cat, cents]) => `- ${cat}: ${formatCents(cents)}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
  }

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

  function bulkSetActive(category: string, active: boolean) {
    setSubscriptions(
      subscriptions.map((s) => (s.category === category ? { ...s, active } : s)),
    );
  }

  function duplicateSubscription(id: string) {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;
    setSubscriptions([
      ...subscriptions,
      { ...sub, id: crypto.randomUUID(), name: `${sub.name} (copy)`, priceHistory: [] },
    ]);
  }

  function deleteSubscription(id: string) {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;

    setSubscriptions(subscriptions.filter((s) => s.id !== id));

    let logEntry: CancellationLogEntry | null = null;
    if (sub.active) {
      logEntry = {
        id: crypto.randomUUID(),
        name: sub.name,
        monthlyEquivalentCentsAtCancellation: monthlyEquivalentCents(
          sub.amountCents,
          sub.billingCycle,
        ),
        cancelledAt: new Date().toISOString(),
      };
      setCancellationLog([...cancellationLog, logEntry]);
    }

    const entryToRemove = logEntry;
    setToast({
      message: `Deleted ${sub.name}`,
      actionLabel: "Undo",
      onAction: () => {
        setSubscriptions((current) => [...current, sub]);
        if (entryToRemove) {
          setCancellationLog((current) => current.filter((e) => e.id !== entryToRemove.id));
        }
        setToast(null);
      },
    });
  }

  function addRefund(refund: Omit<Refund, "id" | "status" | "receivedAt">) {
    setRefunds([...refunds, { ...refund, id: crypto.randomUUID(), status: "pending", receivedAt: null }]);
  }

  function markRefundReceived(id: string) {
    setRefunds(
      refunds.map((r) =>
        r.id === id ? { ...r, status: "received", receivedAt: new Date().toISOString() } : r,
      ),
    );
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {subscriptions.length} subscription{subscriptions.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        <SettingsBar
          theme={theme}
          onThemeChange={setTheme}
          showShare={showShare}
          onShowShareChange={setShowShare}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onImportCsv={handleImportCsv}
          onCopySummary={handleCopySummary}
          onExportCsv={handleExportCsv}
        />
      </div>

      {(upcomingRenewals.length > 0 || trialsEndingSoon.length > 0) && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This week: {upcomingRenewals.length} renewal{upcomingRenewals.length === 1 ? "" : "s"}{" "}
          totaling{" "}
          {formatCents(upcomingRenewals.reduce((sum, s) => sum + s.amountCents, 0))}
          {trialsEndingSoon.length > 0 &&
            `, ${trialsEndingSoon.length} trial${trialsEndingSoon.length === 1 ? "" : "s"} ending`}
          .
        </p>
      )}

      {trialsEndingSoon.length > 0 && (
        <section className="flex flex-col gap-1 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
          <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Free trials ending soon
          </h2>
          <ul className="flex flex-col gap-1">
            {trialsEndingSoon.map((s) => (
              <li key={s.id} className="text-sm text-blue-900 dark:text-blue-200">
                {s.name} starts charging {formatCents(s.amountCents)} on {s.trialEndsDate} —{" "}
                cancel now if you don&apos;t want it
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Your monthly spend" value={formatCents(totalMonthlyCents)} />
        <StatCard label="Your projected annual cost" value={formatCents(totalAnnualCents)} />
        <StatCard label="Pending refunds" value={formatCents(pendingRefundsCents)} />
        <StatCard label="Renewing this week" value={String(upcomingRenewals.length)} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Budget used"
          value={
            totalBudgetCents > 0
              ? `${formatCents(totalMonthlyCents)} / ${formatCents(totalBudgetCents)}`
              : "No budgets set"
          }
        />
        <StatCard label="Saved from cancellations (annualized)" value={formatCents(lifetimeSavedFromCancellations)} />
        <StatCard label="Price hike impact (annualized)" value={formatCents(priceHikeImpactCents)} />
      </section>

      {topExpenseSubs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">
            Most expensive to you (annualized, your share)
          </h2>
          <ul className="flex flex-col gap-1">
            {topExpenseSubs.map((s) => (
              <li key={s.id} className="text-sm">
                {s.name} —{" "}
                {formatCents(
                  annualEquivalentCents(yourShareCents(s.amountCents, s.splitCount), s.billingCycle),
                )}
                /yr
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Spending breakdown</h2>
        <CategoryChart spendByCategory={spendByCategory} onSelectCategory={setCategoryFilter} />
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
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          showShare={showShare}
          onUpdatePrice={updateSubscriptionPrice}
          onToggleActive={toggleActive}
          onDelete={deleteSubscription}
          onDuplicate={duplicateSubscription}
          onBulkSetActive={bulkSetActive}
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

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => setToast(null)}
        />
      )}
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
