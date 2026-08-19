import { useMemo, useState } from "react";
import type { BiasFlag, LongitudinalReview, ReflectionSummary } from "@/lib/types";
import { evidenceLinksFor } from "@/lib/longitudinal";
import { patternKey } from "@/lib/corrections";
import { confidenceLanguage } from "@/lib/confidence";
import { dateAfterDays, FOLLOW_UP_DELAYS } from "@/lib/followUp";

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

function verdictLabel(v: LongitudinalReview["assumptionVerdict"]) {
  if (v === "supported") return "Assumption supported";
  if (v === "unsupported") return "Assumption unsupported";
  if (v === "partial") return "Partially supported";
  if (v === "unclear") return "Unclear";
  return v ?? "";
}

function verdictTone(v: LongitudinalReview["assumptionVerdict"]) {
  if (v === "supported") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (v === "unsupported") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (v === "partial") return "bg-sky-500/15 text-sky-700 border-sky-500/30";
  return "bg-zinc-500/15 text-zinc-600 border-zinc-500/30";
}

function isDue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() <= today.getTime();
}

export default function SummaryView({
  summary,
  longitudinalReview,
  onFollowUp,
  onSaveReview,
  onClearReview,
  onDismissPattern,
}: {
  summary: ReflectionSummary;
  longitudinalReview?: LongitudinalReview | null;
  onFollowUp?: (at: string | null, note: string | null) => void;
  onSaveReview?: (patch: Partial<LongitudinalReview>) => void;
  onClearReview?: () => void;
  onDismissPattern?: (bias: BiasFlag) => void;
}) {
  const trace = summary.trace;
  const hasFollowUp = Boolean(trace?.followUpAt || trace?.followUpNote);
  const review = longitudinalReview ?? null;
  const predicted = (trace as unknown as { predictedOutcome?: string })?.predictedOutcome ?? null;
  const evidenceLinks = useMemo(() => evidenceLinksFor({ id: "tmp", createdAt: new Date().toISOString(), title: "", messages: [], status: "complete", summary } as unknown as import("@/lib/types").Entry), [summary]);

  // form state for the full loop
  const [draftAction, setDraftAction] = useState(review?.actualActionTaken ?? "");
  const [draftOutcome, setDraftOutcome] = useState(review?.actualOutcome ?? "");
  const [draftVerdict, setDraftVerdict] = useState<LongitudinalReview["assumptionVerdict"]>(review?.assumptionVerdict ?? null);
  const [draftNote, setDraftNote] = useState(review?.calibrationNote ?? "");
  const [editingReview, setEditingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(Boolean(review));
  const [showFollowUpOptions, setShowFollowUpOptions] = useState(false);
  const [customFollowUpDate, setCustomFollowUpDate] = useState("");
  const [dismissedPatterns, setDismissedPatterns] = useState<string[]>([]);

  // keep drafts in sync when review changes externally
  // (avoid effect loops: only sync when review identity changes via key)
  const reviewKey = review ? `${review.reviewedAt ?? ""}:${review.assumptionVerdict ?? ""}` : "none";

  const canSave = Boolean(draftOutcome.trim()) && Boolean(draftVerdict);
  const visibleBiases = summary.possibleBiases.filter((bias) => !dismissedPatterns.includes(patternKey({ kind: "bias", label: bias.type })));

  return (
    <div className="flex flex-col gap-5" key={reviewKey}>
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
          <p className="mt-1 text-xs text-muted">event → observations → assumptions → emotion → alternatives → outcome → action → predicted outcome → follow-up</p>
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
            {predicted && (
              <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
                <p className="text-xs font-medium text-accent">What did I think would happen?</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{predicted}</p>
                <p className="mt-1 text-[11px] text-muted">This is your prediction — you&apos;ll calibrate it at follow-up.</p>
              </div>
            )}
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

      {visibleBiases.length > 0 && (
        <div>
          <Section title="Patterns to consider (tentative, not diagnoses)">
            <ul className="flex flex-col gap-3">
              {visibleBiases.map((b, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-review/30 bg-reviewsoft px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-review">{b.type}</span>
                    <span className="text-xs font-medium text-muted">{confidenceLanguage(b.confidence).label}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{b.description}</p>
                  <p className="mt-1 text-xs italic text-muted">{confidenceLanguage(b.confidence).detail}</p>
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
                  {onDismissPattern && <button type="button" onClick={() => { setDismissedPatterns((current) => [...current, patternKey({ kind: "bias", label: b.type })]); onDismissPattern(b); }} className="mt-3 text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-foreground">Stop showing this pattern</button>}
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
      {evidenceLinks.length > 0 && evidenceLinks.some((l) => l.linkedAssumptions.length > 0 || l.linkedAlternatives.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence-linked observations</h3>
          <p className="mt-1 text-xs text-muted">Which facts support which assumptions or alternatives.</p>
          <div className="mt-2 flex flex-col gap-2">
            {evidenceLinks.filter((l) => l.linkedAssumptions.length || l.linkedAlternatives.length).slice(0, 4).map((l, i) => (
              <div key={i} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
                <p className="text-sm font-medium">“{l.observation.slice(0, 90)}”</p>
                {l.linkedAssumptions.length > 0 && <p className="mt-1 text-muted">→ assumption: {l.linkedAssumptions[0].slice(0, 80)}</p>}
                {l.linkedAlternatives.length > 0 && <p className="text-muted">→ also fits: {l.linkedAlternatives[0].slice(0, 80)}</p>}
              </div>
            ))}
          </div>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Follow-up · close the loop
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                What did you <span className="font-medium text-foreground">think would happen</span> → what <span className="font-medium text-foreground">actually happened</span>?
              </p>
            </div>
            {trace.followUpAt && isDue(trace.followUpAt) && !review && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700">Due</span>
            )}
            {review?.assumptionVerdict && (
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${verdictTone(review.assumptionVerdict)}`}>
                {verdictLabel(review.assumptionVerdict)}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-muted">
            {trace.followUpAt ? (
              <>Check back on <span className="font-medium text-foreground">{trace.followUpAt}</span> to calibrate your prediction against reality.</>
            ) : (
              <>No follow-up date set yet — pick one so you can test the prediction.</>
            )}
          </p>
          {trace.followUpNote && !review && (
            <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <span className="text-xs font-medium text-muted">Legacy outcome note:</span> {trace.followUpNote}
            </p>
          )}
          {onFollowUp && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!trace.followUpAt && <button type="button" onClick={() => setShowFollowUpOptions((value) => !value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">{showFollowUpOptions ? "Hide check-in options" : "Choose a delayed check-in"}</button>}
              {trace.followUpAt && (
                <button
                  type="button"
                  onClick={() => setShowReviewForm((v) => !v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${showReviewForm ? "border border-border bg-background text-foreground" : "bg-accent text-white hover:bg-accent-hover"}`}
                >
                  {review ? (showReviewForm ? "Hide review" : "View review") : isDue(trace.followUpAt) ? "Record what actually happened →" : "Prepare follow-up review"}
                </button>
              )}
              {!trace.followUpAt && (
                <button
                  type="button"
                  onClick={() => setShowReviewForm((v) => !v)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-card-hover"
                >
                  {showReviewForm ? "Hide review" : "Add review without date"}
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

          {onFollowUp && !trace.followUpAt && showFollowUpOptions && (
            <div className="mt-3 rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-medium text-muted">Choose when to compare the prediction with reality.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOLLOW_UP_DELAYS.map((option) => (
                  <button key={option.days} type="button" onClick={() => { onFollowUp(dateAfterDays(option.days), trace.followUpNote); setShowFollowUpOptions(false); }} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-card-hover">{option.label}</button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Pick a date
                  <input type="date" value={customFollowUpDate} min={dateAfterDays(1)} onChange={(event) => setCustomFollowUpDate(event.target.value)} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </label>
                <button type="button" disabled={!customFollowUpDate} onClick={() => { onFollowUp(customFollowUpDate, trace.followUpNote); setShowFollowUpOptions(false); }} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40">Set date</button>
              </div>
            </div>
          )}

          {/* Full longitudinal loop */}
          {(showReviewForm || review) && onSaveReview && (
            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              {!review || editingReview ? (
                <div className="flex flex-col gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">What actually happened? Was the assumption supported?</p>
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted">What action did I actually take?</span>
                      <textarea
                        value={draftAction}
                        onChange={(e) => setDraftAction(e.target.value)}
                        placeholder={trace.intendedAction}
                        rows={2}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                      <span className="text-[11px] text-muted">Defaults to your intended action — edit if you did something different.</span>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted">What actually happened? <span className="text-danger">*</span></span>
                      <textarea
                        value={draftOutcome}
                        onChange={(e) => setDraftOutcome(e.target.value)}
                        placeholder="What happened after you acted? Be factual — what was said/done, not just how it felt."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </label>
                    <div>
                      <p className="text-xs font-medium text-muted">Was my original assumption supported? <span className="text-danger">*</span></p>
                      <p className="mt-0.5 text-[11px] text-muted">Test &ldquo;{trace.assumptions[0] ?? "my key assumption"}&rdquo; against what actually happened.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["supported", "unsupported", "partial", "unclear"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setDraftVerdict(v)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${draftVerdict === v ? verdictTone(v) + " ring-2 ring-offset-1 ring-accent/20" : "border-border bg-card text-muted hover:bg-card-hover"}`}
                          >
                            {verdictLabel(v)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted">What did I learn? (calibration)</span>
                      <textarea
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="e.g. I predicted they'd be dismissive — they were actually curious. My mind-reading was unsupported this time."
                        rows={2}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => {
                        onSaveReview({
                          actualActionTaken: draftAction.trim() || trace.intendedAction,
                          actualOutcome: draftOutcome.trim(),
                          assumptionVerdict: draftVerdict,
                          calibrationNote: draftNote.trim() || null,
                        });
                        setEditingReview(false);
                      }}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save review
                    </button>
                    {review && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftAction(review.actualActionTaken ?? "");
                          setDraftOutcome(review.actualOutcome ?? "");
                          setDraftVerdict(review.assumptionVerdict);
                          setDraftNote(review.calibrationNote ?? "");
                          setEditingReview(false);
                        }}
                        className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-card-hover"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {!canSave && <p className="text-xs text-muted">Add what actually happened and pick a verdict to save.</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Review — {review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString() : ""}</p>
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${verdictTone(review.assumptionVerdict)}`}>{verdictLabel(review.assumptionVerdict)}</span>
                  </div>
                  {predicted && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">You predicted</p>
                        <p className="mt-1 text-sm">{predicted}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">What actually happened</p>
                        <p className="mt-1 text-sm">{review.actualOutcome ?? "—"}</p>
                      </div>
                    </div>
                  )}
                  {!predicted && review.actualOutcome && (
                    <p className="text-sm"><span className="font-medium">Outcome:</span> {review.actualOutcome}</p>
                  )}
                  {review.actualActionTaken && review.actualActionTaken !== trace.intendedAction && (
                    <p className="text-sm text-muted">Action taken: <span className="text-foreground">{review.actualActionTaken}</span> <span className="text-xs">(intended: {trace.intendedAction})</span></p>
                  )}
                  {review.calibrationNote && (
                    <p className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-sm">
                      <span className="text-xs font-medium text-accent">Calibration:</span> {review.calibrationNote}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingReview(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Edit review</button>
                    {onClearReview && (
                      <button type="button" onClick={onClearReview} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-card-hover">Clear review</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
