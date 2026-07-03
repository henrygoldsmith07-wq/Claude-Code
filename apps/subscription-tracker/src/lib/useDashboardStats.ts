import { useMemo } from "react";
import {
  monthlyEquivalentCents,
  annualEquivalentCents,
  yourShareCents,
  daysUntil,
} from "./money";
import type { Budget, CancellationLogEntry, Refund, Subscription } from "./types";

export function useDashboardStats(
  subscriptions: Subscription[],
  refunds: Refund[],
  budgets: Budget[],
  cancellationLog: CancellationLogEntry[],
) {
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.active), [subscriptions]);

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

  const pendingRefundsCents = useMemo(
    () =>
      refunds
        .filter((r) => r.status !== "received")
        .reduce((sum, r) => sum + r.amountCents, 0),
    [refunds],
  );

  const totalAnnualCents = totalMonthlyCents * 12;
  const totalBudgetCents = useMemo(
    () => budgets.reduce((sum, b) => sum + b.monthlyLimitCents, 0),
    [budgets],
  );

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

  const lifetimeSavedFromCancellations = useMemo(
    () =>
      cancellationLog.reduce(
        (sum, entry) => sum + entry.monthlyEquivalentCentsAtCancellation * 12,
        0,
      ),
    [cancellationLog],
  );

  const priceHikeImpactCents = useMemo(
    () =>
      subscriptions.reduce((sum, s) => {
        if (s.priceHistory.length === 0) return sum;
        const oldest = s.priceHistory[0].amountCents;
        const increase =
          annualEquivalentCents(s.amountCents, s.billingCycle) -
          annualEquivalentCents(oldest, s.billingCycle);
        return sum + Math.max(0, increase);
      }, 0),
    [subscriptions],
  );

  return {
    activeSubs,
    totalMonthlyCents,
    spendByCategory,
    upcomingRenewals,
    pendingRefundsCents,
    totalAnnualCents,
    totalBudgetCents,
    topExpenseSubs,
    trialsEndingSoon,
    lifetimeSavedFromCancellations,
    priceHikeImpactCents,
  };
}
