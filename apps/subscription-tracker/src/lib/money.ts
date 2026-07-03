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

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
