import type { Budget, CancellationLogEntry, Refund, Subscription } from "./types";

export interface BackupData {
  version: 1;
  exportedAt: string;
  subscriptions: Subscription[];
  budgets: Budget[];
  refunds: Refund[];
  cancellationLog: CancellationLogEntry[];
}

export function buildBackup(
  subscriptions: Subscription[],
  budgets: Budget[],
  refunds: Refund[],
  cancellationLog: CancellationLogEntry[],
): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    subscriptions,
    budgets,
    refunds,
    cancellationLog,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupData {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.subscriptions)) {
    throw new Error("Not a valid subscription tracker backup file");
  }
  return {
    version: 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    subscriptions: data.subscriptions,
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    refunds: Array.isArray(data.refunds) ? data.refunds : [],
    cancellationLog: Array.isArray(data.cancellationLog) ? data.cancellationLog : [],
  };
}
