import type { ReflectionSummary } from "@/lib/types";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function SummaryView({ summary }: { summary: ReflectionSummary }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-accent/8 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          What's actually underneath it
        </h3>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {summary.coreEmotion}
        </p>
      </div>

      {summary.underlyingTriggers.length > 0 && (
        <Section title="What actually triggered it">
          <ul className="list-inside list-disc space-y-1">
            {summary.underlyingTriggers.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      {summary.possibleBiases.length > 0 && (
        <Section title="Where you might be reasoning in your own favor">
          <ul className="flex flex-col gap-2">
            {summary.possibleBiases.map((b, i) => (
              <li
                key={i}
                className="rounded-xl border border-review/30 bg-reviewsoft px-3.5 py-2.5"
              >
                <span className="font-medium text-review">
                  {b.type}
                </span>
                <span className="text-muted"> — {b.description}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="How the other side might see it">
        <p>{summary.otherPerspective}</p>
      </Section>

      <Section title="Honest assessment">
        <p>{summary.balancedAssessment}</p>
      </Section>

      {summary.cautionFlags.length > 0 && (
        <Section title="Pause before you act on these">
          <ul className="flex flex-col gap-2">
            {summary.cautionFlags.map((c, i) => (
              <li
                key={i}
                className="rounded-xl border border-danger/30 bg-dangersoft px-3.5 py-2.5"
              >
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sensible next steps">
        <ul className="list-inside list-disc space-y-1">
          {summary.suggestedNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
