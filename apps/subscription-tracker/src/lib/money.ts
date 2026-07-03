import type { BillingCycle } from "./types";

export function monthlyEquivalentCents(amountCents: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "yearly":
      return Math.round(amountCents / 12);
    case "monthly":
    default:
      return amountCents;
  }
}

export function annualEquivalentCents(amountCents: number, cycle: BillingCycle): number {
  return monthlyEquivalentCents(amountCents, cycle) * 12;
}

export function yourShareCents(amountCents: number, splitCount: number): number {
  return Math.round(amountCents / Math.max(1, splitCount));
}

export function annualSwitchSavingsCents(
  amountCents: number,
  cycle: BillingCycle,
  yearlyPriceCents: number | null,
): number {
  if (yearlyPriceCents === null || cycle !== "monthly") return 0;
  return Math.max(0, annualEquivalentCents(amountCents, cycle) - yearlyPriceCents);
}

export function formatCents(cents: number, currencyCode: string = "USD"): string {
  try {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currencyCode,
    });
  } catch {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysSince(dateStr: string): number {
  return -daysUntil(dateStr);
}

export function estimateLifetimePaidCents(
  amountCents: number,
  cycle: BillingCycle,
  createdAt: string,
): number {
  const monthsElapsed = Math.max(0, daysSince(createdAt.slice(0, 10)) / 30);
  return Math.round(monthlyEquivalentCents(amountCents, cycle) * monthsElapsed);
}
