import { formatCents } from "@/lib/money";
import type { Subscription } from "@/lib/types";

interface Props {
  upcomingRenewals: Subscription[];
  trialsEndingSoon: Subscription[];
}

export default function SummaryBanners({ upcomingRenewals, trialsEndingSoon }: Props) {
  return (
    <>
      {(upcomingRenewals.length > 0 || trialsEndingSoon.length > 0) && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This week: {upcomingRenewals.length} renewal{upcomingRenewals.length === 1 ? "" : "s"}{" "}
          totaling {formatCents(upcomingRenewals.reduce((sum, s) => sum + s.amountCents, 0))}
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
    </>
  );
}
