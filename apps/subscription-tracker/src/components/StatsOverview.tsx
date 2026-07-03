import { annualEquivalentCents, yourShareCents, formatCents } from "@/lib/money";
import type { Subscription } from "@/lib/types";

interface Props {
  totalMonthlyCents: number;
  totalAnnualCents: number;
  pendingRefundsCents: number;
  upcomingRenewalsCount: number;
  totalBudgetCents: number;
  lifetimeSavedFromCancellations: number;
  priceHikeImpactCents: number;
  totalCancelledCount: number;
  totalLifetimePaidCents: number;
  topExpenseSubs: Subscription[];
}

export default function StatsOverview({
  totalMonthlyCents,
  totalAnnualCents,
  pendingRefundsCents,
  upcomingRenewalsCount,
  totalBudgetCents,
  lifetimeSavedFromCancellations,
  priceHikeImpactCents,
  totalCancelledCount,
  totalLifetimePaidCents,
  topExpenseSubs,
}: Props) {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Your monthly spend" value={formatCents(totalMonthlyCents)} />
        <StatCard label="Your projected annual cost" value={formatCents(totalAnnualCents)} />
        <StatCard label="Pending refunds" value={formatCents(pendingRefundsCents)} />
        <StatCard label="Renewing this week" value={String(upcomingRenewalsCount)} />
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
        <StatCard
          label="Saved from cancellations (annualized)"
          value={formatCents(lifetimeSavedFromCancellations)}
        />
        <StatCard
          label="Price hike impact (annualized)"
          value={formatCents(priceHikeImpactCents)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Subscriptions cancelled (all time)" value={String(totalCancelledCount)} />
        <StatCard label="Estimated lifetime paid" value={formatCents(totalLifetimePaidCents)} />
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
                  s.currencyCode,
                )}
                /yr
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
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
