import { buildCsv, downloadCsv } from "./csvExport";
import { parseSubscriptionsCsv } from "./csvImport";
import { buildBackup, downloadJson, parseBackup } from "./backup";
import { formatCents } from "./money";
import type { Budget, CancellationLogEntry, Refund, Subscription, ToastState } from "./types";

export function useDataPortability(
  subscriptions: Subscription[],
  setSubscriptions: (value: Subscription[]) => void,
  budgets: Budget[],
  setBudgets: (value: Budget[]) => void,
  refunds: Refund[],
  setRefunds: (value: Refund[]) => void,
  cancellationLog: CancellationLogEntry[],
  setCancellationLog: (value: CancellationLogEntry[]) => void,
  setToast: (toast: ToastState | null) => void,
  summaryStats: {
    totalMonthlyCents: number;
    totalAnnualCents: number;
    pendingRefundsCents: number;
    upcomingRenewalsCount: number;
    lifetimeSavedFromCancellations: number;
    spendByCategory: Record<string, number>;
  },
) {
  function handleExportCsv() {
    const csv = buildCsv(subscriptions, budgets, refunds);
    downloadCsv(csv, `subscription-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleExportBackup() {
    const backup = buildBackup(subscriptions, budgets, refunds, cancellationLog);
    downloadJson(
      backup,
      `subscription-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
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
      `Your monthly spend: ${formatCents(summaryStats.totalMonthlyCents)}`,
      `Your projected annual cost: ${formatCents(summaryStats.totalAnnualCents)}`,
      `Pending refunds: ${formatCents(summaryStats.pendingRefundsCents)}`,
      `Renewing this week: ${summaryStats.upcomingRenewalsCount}`,
      `Lifetime saved from cancellations: ${formatCents(summaryStats.lifetimeSavedFromCancellations)}`,
      "",
      "Top spend by category:",
      ...Object.entries(summaryStats.spendByCategory).map(
        ([cat, cents]) => `- ${cat}: ${formatCents(cents)}`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return {
    handleExportCsv,
    handleExportBackup,
    handleImportBackup,
    handleImportCsv,
    handleCopySummary,
  };
}
