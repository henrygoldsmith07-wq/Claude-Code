"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { confidenceLabel } from "@/domain/analytics";
import { recomputeStates } from "@/domain/events";
import { consistency, countActivity, difficultyTrends, domainSummaries, realWorldFrequency, skillProgress } from "@/domain/progress";
import { getSkill } from "@/domain/skills";
import { analyse, EXPERIMENT_TEMPLATES, createExperiment, progressOf, MEASURE_LABELS } from "@/domain/experiments";
import { domainCoverage } from "@/domain/gamification";
import { buildEvidenceLedger } from "@/domain/evidence";
import { Badge, Button, Card, EmptyState, Evidence, Hedged, Meter, PageHeader, Skeleton } from "@/components/ui";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { useStore } from "@/state/store";
import { useNow } from "@/state/clock";

// ---------------------------------------------------------------------------
// Progress.
//
// No overall score anywhere on this page. It is organised as: what you did
// (counts), what changed (per-skill), what the app noticed (insights, clearly
// marked as observation or interpretation), and what you are testing
// (experiments).
// ---------------------------------------------------------------------------

const TABS = ["Activity", "Skills", "Evidence", "Insights", "Review", "Experiments"] as const;
type Tab = (typeof TABS)[number];

export default function ProgressPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("Activity");
  const now = useNow();

  const previousStates = useMemo(() => {
    const weekAgo = new Date(new Date(now).getTime() - 7 * 86_400_000).toISOString();
    return recomputeStates("local", store.events.filter((event) => event.at < weekAgo), weekAgo);
  }, [store.events, now]);

  if (!store.ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const counts = countActivity(store.events);
  const streak = consistency(store.events, now);
  const realWorld = realWorldFrequency(store.attempts, now);
  const progress = skillProgress(store.states, previousStates);
  const trends = difficultyTrends(store.attempts);
  const domains = domainSummaries(store.states);
  const coverage = domainCoverage(store.states);
  const evidenceLedger = buildEvidenceLedger({
    evaluations: store.evaluations,
    simulations: store.simulations,
    attempts: store.attempts,
    states: store.states,
  });
  const latestReview = [...store.reviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle="Separate measures, not one score. Where a number is an estimate rather than a count, it says so."
      />

      <div className="mb-5 flex gap-1 overflow-x-auto" role="tablist" aria-label="Progress sections">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: tab === item ? "var(--accent-soft)" : "transparent",
              color: tab === item ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Activity" ? (
        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold">What you have done</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Skills practised" value={counts.skillsPractised} />
              <Stat label="Practice conversations" value={counts.simulations} />
              <Stat label="Real-world attempts" value={counts.challengesAttempted} />
              <Stat label="Completed" value={counts.challengesCompleted} />
              <Stat label="Active days (28)" value={streak.activeDays} />
              <Stat label="Real attempts / week" value={realWorld.perWeek} />
            </dl>
            {streak.usualDay ? (
              <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
                Most of your training happens on {streak.usualDay}s.
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Coverage</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              How much of each domain you have touched. Not a completion target.
            </p>
            <div className="mt-4 space-y-3">
              {coverage.map((item) => (
                <Meter
                  key={item.domain}
                  value={item.total ? item.practised / item.total : 0}
                  label={item.label}
                  sublabel={`${item.practised}/${item.total}`}
                />
              ))}
            </div>
          </Card>

          {store.achievements.length > 0 ? (
            <Card>
              <h2 className="text-base font-semibold">Milestones</h2>
              <ul className="mt-3 space-y-2">
                {store.achievements.map((achievement) => (
                  <li key={achievement.id} className="text-sm">
                    <span className="font-medium">{achievement.label}</span>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{achievement.description}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "Skills" ? (
        <div className="space-y-4">
          {progress.length === 0 ? (
            <EmptyState
              title="Nothing measured yet"
              body="Skill movement appears once you have practised something. One session is enough to start."
            />
          ) : (
            <Card>
              <h2 className="text-base font-semibold">Movement this week</h2>
              <ul className="mt-4 space-y-4">
                {progress.slice(0, 8).map((item) => (
                  <li key={item.skillId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                        {item.confidentEstimate ? item.state : "estimating"}
                        {item.masteryDelta !== 0
                          ? ` · ${item.masteryDelta > 0 ? "+" : ""}${(item.masteryDelta * 100).toFixed(0)}pp`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      <Meter value={item.mastery} uncertainty={0} label="What you do" />
                      <Meter value={item.confidence} uncertainty={0} label="How it feels" />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {trends.some((trend) => trend.statement) ? (
            <Card>
              <h2 className="text-base font-semibold">Difficulty over time</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                From your own 1–5 ratings after each real attempt.
              </p>
              <Evidence items={trends.filter((trend) => trend.statement).map((trend) => trend.statement as string)} />
            </Card>
          ) : null}

          <Card>
            <h2 className="text-base font-semibold">By domain</h2>
            <ul className="mt-3 space-y-2">
              {domains.map((domain) => (
                <li key={domain.domain} className="flex items-center justify-between gap-3 text-sm">
                  <span>{domain.label}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {domain.hasEvidence ? `${domain.practised} of ${domain.total} practised` : "no evidence yet"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "Insights" ? (
        <div className="space-y-3">
          {store.insights.length === 0 ? (
            <EmptyState
              title="No patterns yet"
              body="Insights appear once there is enough data to compare. Nothing is generated from two or three sessions — that would just be noise with a confident sentence attached."
            />
          ) : (
            store.insights.map((insight) => (
              <Card key={insight.id}>
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={insight.kind === "observation" ? "accent" : "neutral"}>
                    {confidenceLabel(insight)}
                  </Badge>
                  <button
                    onClick={() => void store.dismissInsight(insight.id)}
                    aria-label="Dismiss insight"
                    style={{ color: "var(--text-faint)" }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed font-medium">{insight.observation}</p>
                <Evidence items={insight.evidence} />
                <Hedged>{insight.possibleExplanation}</Hedged>
                <p className="mt-3 text-sm">
                  <span className="font-medium">Suggested: </span>
                  {insight.recommendedAction}
                </p>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === "Evidence" ? <EvidenceLedger profiles={evidenceLedger} /> : null}

      {tab === "Review" ? (
        <div className="space-y-4">
          {!latestReview ? (
            <EmptyState
              title="No weekly review yet"
              body="A review is generated automatically at the start of each week, from that week's training."
            />
          ) : (
            <Card>
              <Badge tone="accent">Week of {latestReview.weekStart}</Badge>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Sessions" value={latestReview.trainingCompleted.sessions} />
                <Stat label="Conversations" value={latestReview.trainingCompleted.simulations} />
                <Stat label="Challenges" value={latestReview.trainingCompleted.challenges} />
                <Stat label="Reflections" value={latestReview.trainingCompleted.reflections} />
              </dl>

              {latestReview.strongestEvidence ? (
                <section className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold">Strongest evidence</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed">{latestReview.strongestEvidence.statement}</p>
                  <Evidence items={latestReview.strongestEvidence.evidence} />
                </section>
              ) : (
                <p className="mt-5 text-sm" style={{ color: "var(--text-muted)" }}>
                  Not enough happened this week to point at anything specific. That is a fact about the week, not
                  about you.
                </p>
              )}

              {latestReview.needsReinforcement.length > 0 ? (
                <section className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold">Worth reinforcing</h3>
                  <ul className="mt-2 space-y-1.5">
                    {latestReview.needsReinforcement.map((item) => (
                      <li key={item.skillId} className="text-sm">
                        <span className="font-medium">{getSkill(item.skillId)?.name ?? item.skillId}</span>
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {latestReview.difficultyProgression.length > 0 ? (
                <section className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold">Difficulty progression</h3>
                  <Evidence
                    items={latestReview.difficultyProgression.map(
                      (item) => `${getSkill(item.skillId)?.name ?? item.skillId}: ${item.from}/5 → ${item.to}/5`,
                    )}
                  />
                </section>
              ) : null}

              <section className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold">Next week</h3>
                <p className="mt-1.5 text-[15px]">
                  {getSkill(latestReview.nextFocus.skillId)?.name ?? latestReview.nextFocus.skillId}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{latestReview.nextFocus.reason}</p>
              </section>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "Experiments" ? <Experiments /> : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Experiments() {
  const store = useStore();
  const active = store.experiments.filter((item) => !item.endedAt);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold">Run an experiment</h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Test one change to how you communicate, and compare the occasions where you applied it with the ones where
          you did not. The comparison is weak evidence by design — it is your own rating of your own conversations —
          and the result says so.
        </p>
        <ul className="mt-4 space-y-2">
          {EXPERIMENT_TEMPLATES.map((template) => (
            <li key={template.question} className="flex items-start justify-between gap-3">
              <span className="text-sm">{template.question}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void store.startExperiment(createExperiment("local", template, new Date().toISOString()))}
              >
                Start
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {active.map((experiment) => {
        const observations = store.observations.filter((item) => item.experimentId === experiment.id);
        const result = analyse(experiment, observations);
        const status = progressOf(experiment, observations);
        const measure = MEASURE_LABELS[experiment.measure];
        return (
          <Card key={experiment.id}>
            <Badge tone="accent">Running</Badge>
            <h3 className="mt-3 text-base font-semibold">{experiment.question}</h3>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>{experiment.plan}</p>
            <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
              {status.recorded} occasions recorded · {status.ready ? "enough to compare" : "not comparable yet"}
            </p>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-medium">{measure.question}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant="secondary"
                    aria-label={`Applied the change, rated ${value}`}
                    onClick={() =>
                      void store.recordObservation({
                        id: `obs.${Date.now()}.${value}`,
                        experimentId: experiment.id,
                        applied: true,
                        value,
                        createdAt: new Date().toISOString(),
                      })
                    }
                    className="w-11"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
                Above: occasions where you applied the change. Below: occasions where you did not.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant="ghost"
                    aria-label={`Did not apply the change, rated ${value}`}
                    onClick={() =>
                      void store.recordObservation({
                        id: `obs.${Date.now()}.n${value}`,
                        experimentId: experiment.id,
                        applied: false,
                        value,
                        createdAt: new Date().toISOString(),
                      })
                    }
                    className="w-11"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm leading-relaxed">{result.summary}</p>
              <Hedged label="What this cannot tell you">{result.caveat}</Hedged>
              <p className="mt-3 text-sm">
                <span className="font-medium">Next: </span>
                {result.recommendation}
              </p>
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={() => void store.endExperiment(experiment.id)}>
                  End experiment
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

