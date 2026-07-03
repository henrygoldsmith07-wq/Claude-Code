import { monthlyEquivalentCents, yourShareCents } from "./money";
import type { Budget, Refund, Subscription } from "./types";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map((f) => escapeCsvField(String(f))).join(",");
}

function subscriptionsCsvLines(subscriptions: Subscription[]): string[] {
  const lines: string[] = [];
  lines.push("Subscriptions");
  lines.push(
    toCsvRow([
      "Name",
      "Category",
      "Amount",
      "Currency",
      "Billing Cycle",
      "Monthly Equivalent",
      "Split Between",
      "Your Share",
      "Next Renewal",
      "Active",
      "Trial",
      "Cancel URL",
      "Notes",
    ]),
  );
  for (const s of subscriptions) {
    const shareCents = yourShareCents(s.amountCents, s.splitCount);
    lines.push(
      toCsvRow([
        s.name,
        s.category,
        (s.amountCents / 100).toFixed(2),
        s.currencyCode,
        s.billingCycle,
        (monthlyEquivalentCents(s.amountCents, s.billingCycle) / 100).toFixed(2),
        s.splitCount,
        (shareCents / 100).toFixed(2),
        s.nextRenewalDate,
        s.active ? "yes" : "no",
        s.isTrial ? `yes (ends ${s.trialEndsDate ?? "unknown"})` : "no",
        s.cancelUrl ?? "",
        s.notes,
      ]),
    );
  }
  return lines;
}

function budgetsCsvLines(budgets: Budget[]): string[] {
  const lines: string[] = [];
  lines.push("Budgets");
  lines.push(toCsvRow(["Category", "Monthly Limit"]));
  for (const b of budgets) {
    lines.push(toCsvRow([b.category, (b.monthlyLimitCents / 100).toFixed(2)]));
  }
  return lines;
}

function refundsCsvLines(refunds: Refund[]): string[] {
  const lines: string[] = [];
  lines.push("Refunds");
  lines.push(toCsvRow(["Merchant", "Amount", "Expected Date", "Status"]));
  for (const r of refunds) {
    lines.push(toCsvRow([r.merchant, (r.amountCents / 100).toFixed(2), r.expectedDate ?? "", r.status]));
  }
  return lines;
}

export function buildCsv(
  subscriptions: Subscription[],
  budgets: Budget[],
  refunds: Refund[],
): string {
  return [
    ...subscriptionsCsvLines(subscriptions),
    "",
    ...budgetsCsvLines(budgets),
    "",
    ...refundsCsvLines(refunds),
  ].join("\n");
}

export function buildBudgetsCsv(budgets: Budget[]): string {
  return budgetsCsvLines(budgets).join("\n");
}

export function buildRefundsCsv(refunds: Refund[]): string {
  return refundsCsvLines(refunds).join("\n");
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
