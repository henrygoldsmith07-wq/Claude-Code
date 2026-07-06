import type { ReflectionSummary } from "@/lib/types";

export default function SummaryView({ summary }: { summary: ReflectionSummary }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          What&apos;s actually underneath it
        </h3>
        <p className="mt-1 text-lg font-medium">{summary.coreEmotion}</p>
      </div>

      {summary.underlyingTriggers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            What actually triggered it
          </h3>
          <ul className="mt-1 list-inside list-disc text-sm">
            {summary.underlyingTriggers.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.possibleBiases.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Where you might be reasoning in your own favor
          </h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {summary.possibleBiases.map((b, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950"
              >
                <span className="font-medium">{b.type}</span> — {b.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          How the other side might see it
        </h3>
        <p className="mt-1 text-sm">{summary.otherPerspective}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Honest assessment
        </h3>
        <p className="mt-1 text-sm">{summary.balancedAssessment}</p>
      </div>

      {summary.cautionFlags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pause before you act on these
          </h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {summary.cautionFlags.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Sensible next steps
        </h3>
        <ul className="mt-1 list-inside list-disc text-sm">
          {summary.suggestedNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
