"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTheme } from "@/lib/useTheme";
import { useCategories } from "@/lib/useCategories";
import { useDashboardStats } from "@/lib/useDashboardStats";
import { useSubscriptionActions } from "@/lib/useSubscriptionActions";
import { useDataPortability } from "@/lib/useDataPortability";
import { formatCents } from "@/lib/money";
import { buildRenewalsIcs, downloadIcs } from "@/lib/icsExport";
import type { Budget, CancellationLogEntry, Refund, Subscription, ToastState } from "@/lib/types";
import SubscriptionForm from "./SubscriptionForm";
import SubscriptionsList from "./SubscriptionsList";
import BudgetsSection from "./BudgetsSection";
import RefundsSection from "./RefundsSection";
import InsightsPanel from "./InsightsPanel";
import CategoryChart from "./CategoryChart";
import SettingsBar from "./SettingsBar";
import CategoryManager from "./CategoryManager";
import Toast from "./Toast";
import StatsOverview from "./StatsOverview";
import SummaryBanners from "./SummaryBanners";

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
  const [preferredCurrency, setPreferredCurrency] = useLocalStorage<string>(
    "preferredCurrency",
    "USD",
  );

  const { theme, setTheme } = useTheme();
  const { allCategories, customCategories, addCategory, removeCategory } = useCategories();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toast, setToast] = useState<ToastState | null>(null);

  const stats = useDashboardStats(subscriptions, refunds, budgets, cancellationLog);

  const {
    addSubscription,
    updateSubscriptionPrice,
    toggleActive,
    bulkSetActive,
    duplicateSubscription,
    deleteSubscription,
    bulkDeleteSubscriptions,
    toggleFavorite,
    toggleArchive,
    markUsedToday,
  } = useSubscriptionActions(subscriptions, setSubscriptions, cancellationLog, setCancellationLog, setToast);

  function handleExportIcs() {
    downloadIcs(buildRenewalsIcs(subscriptions), "subscription-renewals.ics");
  }

  const { handleExportCsv, handleExportBackup, handleImportBackup, handleImportCsv, handleCopySummary } =
    useDataPortability(
      subscriptions,
      setSubscriptions,
      budgets,
      setBudgets,
      refunds,
      setRefunds,
      cancellationLog,
      setCancellationLog,
      setToast,
      {
        totalMonthlyCents: stats.totalMonthlyCents,
        totalAnnualCents: stats.totalAnnualCents,
        pendingRefundsCents: stats.pendingRefundsCents,
        upcomingRenewalsCount: stats.upcomingRenewals.length,
        lifetimeSavedFromCancellations: stats.lifetimeSavedFromCancellations,
        spendByCategory: stats.spendByCategory,
      },
    );

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
        <p className="text-sm text-ink3">
          {subscriptions.length} subscription{subscriptions.length === 1 ? "" : "s"} tracked
        </p>
        <SettingsBar
          theme={theme}
          onThemeChange={setTheme}
          showShare={showShare}
          onShowShareChange={setShowShare}
          preferredCurrency={preferredCurrency}
          onPreferredCurrencyChange={setPreferredCurrency}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onImportCsv={handleImportCsv}
          onCopySummary={handleCopySummary}
          onExportCsv={handleExportCsv}
          onExportIcs={handleExportIcs}
        />
        <CategoryManager
          customCategories={customCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
        />
      </div>

      <SummaryBanners
        upcomingRenewals={stats.upcomingRenewals}
        trialsEndingSoon={stats.trialsEndingSoon}
      />

      <StatsOverview
        totalMonthlyCents={stats.totalMonthlyCents}
        totalAnnualCents={stats.totalAnnualCents}
        pendingRefundsCents={stats.pendingRefundsCents}
        upcomingRenewalsCount={stats.upcomingRenewals.length}
        totalBudgetCents={stats.totalBudgetCents}
        lifetimeSavedFromCancellations={stats.lifetimeSavedFromCancellations}
        priceHikeImpactCents={stats.priceHikeImpactCents}
        totalCancelledCount={stats.totalCancelledCount}
        totalLifetimePaidCents={stats.totalLifetimePaidCents}
        topExpenseSubs={stats.topExpenseSubs}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Spending breakdown</h2>
        <CategoryChart
          spendByCategory={stats.spendByCategory}
          countByCategory={stats.countByCategory}
          onSelectCategory={setCategoryFilter}
        />
      </section>

      {stats.upcomingRenewals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink3">Renewing in the next 7 days</h2>
          <ul className="flex flex-col gap-1">
            {stats.upcomingRenewals.map((s) => (
              <li key={s.id} className="text-sm">
                {s.name} — {formatCents(s.amountCents, s.currencyCode)} on {s.nextRenewalDate}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <SubscriptionForm
          categories={allCategories}
          defaultCurrencyCode={preferredCurrency}
          onAdd={addSubscription}
        />
        <SubscriptionsList
          categories={allCategories}
          subscriptions={subscriptions}
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          showShare={showShare}
          onUpdatePrice={updateSubscriptionPrice}
          onToggleActive={toggleActive}
          onDelete={deleteSubscription}
          onBulkDelete={bulkDeleteSubscriptions}
          onDuplicate={duplicateSubscription}
          onBulkSetActive={bulkSetActive}
          onToggleFavorite={toggleFavorite}
          onToggleArchive={toggleArchive}
          onMarkUsedToday={markUsedToday}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">AI insights</h2>
        <InsightsPanel subscriptions={subscriptions} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Budgets</h2>
        <BudgetsSection
          categories={allCategories}
          budgets={budgets}
          spendByCategory={stats.spendByCategory}
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
