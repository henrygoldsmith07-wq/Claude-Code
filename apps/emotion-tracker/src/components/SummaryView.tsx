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

export default function SummaryView({
  summary,
  onFollowUp,
}: {
  summary: ReflectionSummary;
  onFollowUp?: (at: string | null, note: string | null) => void;
}) {
  const trace = summary.trace;
  const hasFollowUp = Boolean(trace?.followUpAt || trace?.followUpNote);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-accent/8 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          What&apos;s actually underneath it
        </h3>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {summary.coreEmotion}
        </p>
      </div>

      {trace && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Structured trace
          </h3>
          <p className="mt-1 text-xs text-muted">event → observations → assumptions → emotion → alternatives → outcome → action → follow-up</p>
          <div className="mt-3 grid gap-3">
            <div>
              <p className="text-xs font-medium text-muted">Event</p>
              <p className="mt-1 text-sm">{trace.event}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Observations (facts only)</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {trace.observations.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
            {trace.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted">Assumptions to check</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {trace.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted">Emotion → alternative readings</p>
              <p className="mt-1 text-sm">
                <span className="font-medium">{trace.namedEmotion}</span>
                {trace.alternativeInterpretations.length > 0 && (
                  <span className="text-muted"> — other ways to read it:</span>
                )}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {trace.alternativeInterpretations.map((alt, i) => (
                  <li key={i}>{alt}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs font-medium text-muted">Intended outcome</p>
                <p className="mt-1 text-sm">{trace.intendedOutcome}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs font-medium text-muted">Intended action</p>
                <p className="mt-1 text-sm">{trace.intendedAction}</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div>
          <Section title="Patterns to consider (tentative, not diagnoses)">
            <ul className="flex flex-col gap-3">
              {summary.possibleBiases.map((b, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-review/30 bg-reviewsoft px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-review">{b.type}</span>
                    <span className="text-xs tabular-nums text-muted">
                      confidence {(b.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{b.description}</p>
                  {b.evidenceFor.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted">Evidence for this reading</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                        {b.evidenceFor.map((e, j) => (
                          <li key={j}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {b.evidenceAgainst.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted">Evidence against</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                        {b.evidenceAgainst.map((e, j) => (
                          <li key={j}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
          {summary.hedgedDisclaimer && (
            <p className="mt-2 rounded-lg border border-review/20 bg-reviewsoft/60 px-3 py-2 text-xs italic leading-relaxed text-muted">
              {summary.hedgedDisclaimer}
            </p>
          )}
        </div>
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

      {trace && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Follow-up
          </h3>
          <p className="mt-1 text-sm text-muted">
            {trace.followUpAt ? (
              <>Check back on <span className="font-medium text-foreground">{trace.followUpAt}</span> to see whether your action helped you toward your intended outcome.</>
            ) : (
              <>No follow-up date set yet.</>
            )}
          </p>
          {trace.followUpNote && (
            <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <span className="text-xs font-medium text-muted">Outcome noted:</span> {trace.followUpNote}
            </p>
          )}
          {onFollowUp && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!trace.followUpAt && (
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    const iso = d.toISOString().slice(0, 10);
                    onFollowUp(iso, trace.followUpNote);
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover"
                >
                  Set check-in: 2 days
                </button>
              )}
              {!trace.followUpNote && trace.followUpAt && (
                <button
                  type="button"
                  onClick={() => {
                    const note = window.prompt("What happened since? Did the action help toward your outcome?")?.trim();
                    if (note) onFollowUp(trace.followUpAt, note);
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                >
                  Record outcome
                </button>
              )}
              {hasFollowUp && (
                <button
                  type="button"
                  onClick={() => onFollowUp(null, null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-card-hover"
                >
                  Clear follow-up
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
