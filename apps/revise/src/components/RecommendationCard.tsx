"use client";

import { getSubject, getTopic } from "@/domain/curriculum";
import { ACTIVITY_BLURB, ACTIVITY_LABEL } from "@/domain/recommender";
import type { Recommendation } from "@/domain/types";
import { formatMinutes, recommendationHref } from "@/lib/activity";
import { ButtonLink, Panel, Pill } from "./ui";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-ink3">{label}</span>
      <span className="text-ink2 tabular-nums font-medium">{value}</span>
    </div>
  );
}

function FactorRow({ factors }: { factors: Recommendation["factors"] }) {
  if (!factors) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <Pill title={`Expected marks this activity recovers`}>gain {factors.examGain.toFixed(1)}</Pill>
      <Pill title="Closer exam = higher urgency">urgency ×{factors.urgency.toFixed(2)}</Pill>
      <Pill title="Lower mastery = higher weakness">weak ×{factors.weakness.toFixed(2)}</Pill>
      <Pill title="Decayed retention = higher forgetting risk">forget ×{factors.forgetting.toFixed(2)}</Pill>
      <Pill title="Thin evidence = higher uncertainty (explore)">uncert ×{factors.uncertainty.toFixed(2)}</Pill>
    </div>
  );
}

export function RecommendationCard({
  recommendation,
  variant = "primary",
}: {
  recommendation: Recommendation;
  variant?: "primary" | "secondary";
}) {
  const topic = recommendation.topicId ? getTopic(recommendation.topicId) : null;
  const subject = getSubject(recommendation.subjectId);
  const exp = recommendation.explanation;
  const isPrimary = variant === "primary";

  return (
    <Panel className={isPrimary ? "relative overflow-hidden" : ""}>
      {isPrimary ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill tone="speak">Recommended now</Pill>
          <Pill>{formatMinutes(recommendation.minutes)}</Pill>
          {recommendation.plannedSessionId ? <Pill tone="success">In today&apos;s plan</Pill> : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-1.5">
          <Pill>{ACTIVITY_LABEL[recommendation.activity]}</Pill>
          <span className="text-[11px] text-ink3">{formatMinutes(recommendation.minutes)}</span>
        </div>
      )}

      <h2 className={isPrimary ? "text-lg sm:text-xl font-semibold tracking-tight" : "text-sm font-medium text-ink"}>
        {ACTIVITY_LABEL[recommendation.activity]}
        {topic ? ` · ${topic.title}` : !isPrimary && subject ? ` · ${subject.name}` : ""}
      </h2>
      <p className="text-sm text-ink3 mt-0.5">
        {subject?.name ?? recommendation.subjectId} — {ACTIVITY_BLURB[recommendation.activity]}
      </p>
      <p className="text-sm text-ink2 mt-3 max-w-2xl">{recommendation.reason}</p>

      {/* The brief's exact disclosure: Do electrolysis questions — 18 min / Estimated recoverable marks: 5.6 / Last exam evidence: 46% / No successful retrieval for 11 days / Paper 1: 24 days away */}
      {exp ? (
        <div className="mt-4 rounded-xl bg-surface2 p-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-ink2">Why this now</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <DetailRow label="Estimated recoverable marks" value={`${exp.recoverableMarks.toFixed(1)}`} />
            <DetailRow label="Time" value={formatMinutes(recommendation.minutes)} />
            <DetailRow
              label="Last exam evidence"
              value={exp.lastEvidencePercent != null ? `${exp.lastEvidencePercent}%` : "— no marked work yet"}
            />
            <DetailRow
              label="Last retrieval"
              value={exp.daysSinceRetrieval != null ? `${exp.daysSinceRetrieval} days ago` : exp.lastEvidencePercent == null ? "— never studied" : "— no card history"}
            />
            <DetailRow
              label={exp.paperLabel ? exp.paperLabel : "Next paper"}
              value={exp.daysToExam != null ? `${exp.daysToExam} days away` : "— no date set"}
            />
            {exp.marksPerHour != null ? <DetailRow label="Marks / hour" value={`${exp.marksPerHour.toFixed(1)}`} /> : null}
          </div>
          <FactorRow factors={exp.factors} />
          <p className="text-[11px] text-ink3 mt-1">
            Score ≈ gain × urgency × weakness × forgetting × uncertainty ÷ time. Hover a pill for what it means.
          </p>
        </div>
      ) : (
        <FactorRow factors={recommendation.factors ?? recommendation.explanation?.factors} />
      )}

      <div className={isPrimary ? "mt-4 flex flex-wrap gap-2" : "mt-3"}>
        <ButtonLink
          href={recommendationHref(recommendation)}
          variant={isPrimary ? "primary" : "secondary"}
          className={isPrimary ? "flex-1 sm:flex-none w-full sm:w-auto min-h-[3rem] px-6" : "block w-full"}
        >
          {isPrimary ? "Start now" : "Start"}
        </ButtonLink>
      </div>
    </Panel>
  );
}
