"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { aiDiagnose } from "@/ai/client";
import { gradeCalibrationNarrative } from "@/domain/analytics";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import type { GradePrediction } from "@/domain/grades";
import { ACHIEVEMENTS, levelFor } from "@/domain/gamification";
import { weakTopics } from "@/domain/mastery";
import { mistakePatterns } from "@/domain/mistakes";
import { dueCountByDay, todayIso } from "@/domain/scheduling";
import type { DiagnoseResponse } from "@/ai/types";
import { useStore, useSubjects } from "@/state/store";
import { RichText } from "@/components/RichText";
import { CalibrationCard, DifficultyAndSubtopics, ExpectedMarksCard, MarksLostByCause, PaperSimulationCard, RecurringMisconceptions } from "@/components/AssessmentPanels";
import { ResponseTimeCalibrationPanel } from "@/components/ResponseTimeCalibration";
import { RetentionMasteryPanel } from "@/components/RetentionMasteryPanel";
import { MistakeRootCausePanel } from "@/components/MistakeRootCause";
import { CoverageCard } from "@/components/CoverageCard";
import { Button, Panel, Pill, ProgressBar, SectionHeading, SourceBadge, StatTile, cx } from "@/components/ui";

// Analytics that answer one question — where are the marks? — rather than
// showing every number the app happens to hold. Each panel ends in an action.

function confidenceTone(confidence: number): "success" | "review" {
  return confidence >= 0.72 ? "success" : "review";
}

function confidenceLabel(confidence: number): string {
  if (confidence < 0.45) return "Early estimate";
  if (confidence < 0.72) return "Developing estimate";
  return "Well supported";
}

function PredictedGradeCard({
  prediction,
  subjectName,
  markedAnswers,
  topicTitle,
}: {
  prediction: GradePrediction;
  subjectName: string;
  markedAnswers: number;
  topicTitle: (topicId: string) => string;
}) {
  const narrative = gradeCalibrationNarrative(prediction, topicTitle);
  const next = prediction.headroom[0];
  const evidenceLabel = markedAnswers === 0 ? "No marked answers yet" : `${markedAnswers} marked ${markedAnswers === 1 ? "answer" : "answers"}`;
  const trendLabel = prediction.trend === 0
    ? null
    : `${prediction.trend > 0 ? "+" : "−"}${Math.abs(prediction.trend)}pp over 30 days`;

  return (
    <Panel as="li">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{subjectName}</p>
          <p className="text-xs text-ink3 mt-0.5">Current estimate</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-semibold tabular-nums text-ink">{prediction.grade}</p>
          <p className="text-xs text-ink3 tabular-nums">{prediction.percent}%</p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={prediction.percent / 100} label="Estimated performance" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs text-ink3">
        <Pill tone={confidenceTone(prediction.confidence)}>{confidenceLabel(prediction.confidence)}</Pill>
        <span>{evidenceLabel}</span>
        <span>Range {prediction.worstCase}–{prediction.bestCase}</span>
        {trendLabel ? <span>{trendLabel}</span> : null}
      </div>

      <p className="text-sm text-ink2 mt-3">{narrative.paragraphs[0]}</p>

      {next ? (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Next lever</p>
          <Link
            href={`/practice?topic=${encodeURIComponent(next.topicId)}`}
            className="flex items-center justify-between gap-3 mt-1 group"
          >
            <span className="text-sm text-ink group-hover:underline truncate">{topicTitle(next.topicId)}</span>
            <span className="text-xs text-ink3 tabular-nums shrink-0">up to +{next.potentialPercent}pp →</span>
          </Link>
          <p className="text-[11px] text-ink3 mt-1">Potential gain if this topic reached full mastery.</p>
        </div>
      ) : null}

      <details className="mt-3 border-t border-line pt-2.5">
        <summary className="cursor-pointer text-[11px] font-semibold text-ink3 hover:text-ink">
          How this estimate works
        </summary>
        <p className="text-xs text-ink3 leading-5 mt-2">
          It blends marked exam-question accuracy with topic coverage. Marked answers carry more weight as evidence accumulates; the range stays wider when there is less evidence or more time for your performance to change.
        </p>
      </details>
    </Panel>
  );
}

export default function ProgressPage() {
  const store = useStore();
  const subjects = useSubjects();
  const today = todayIso();
  const [diagnosis, setDiagnosis] = useState<{ data: DiagnoseResponse; source: "ai" | "fallback"; note?: string } | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const weak = useMemo(() => weakTopics(store.mastery, 8), [store.mastery]);
  const patterns = useMemo(() => mistakePatterns(store.mistakes.filter((m) => !m.resolved)), [store.mistakes]);
  const forecast = useMemo(() => dueCountByDay(store.cards, 14, today), [store.cards, today]);
  const maxDue = Math.max(1, ...forecast.map((f) => f.count));
  const level = levelFor(store.streak.xp);

  const totals = useMemo(() => {
    const marksMax = store.attempts.reduce((a, x) => a + x.max, 0);
    return {
      reviews: store.reviewLogs.length,
      accuracy: marksMax ? store.attempts.reduce((a, x) => a + x.awarded, 0) / marksMax : 0,
      hours: Math.round(
        (store.reviewLogs.reduce((a, l) => a + l.elapsedMs, 0) +
          store.attempts.reduce((a, x) => a + x.elapsedMs, 0)) /
          3_600_000,
      ),
      mastered: store.mastery.filter((m) => m.mastery >= 0.8).length,
    };
  }, [store.reviewLogs, store.attempts, store.mastery]);

  async function diagnose() {
    setDiagnosing(true);
    const result = await aiDiagnose(
      weak.map((w) => w.topicId),
      store.mistakes.filter((m) => !m.resolved).slice(0, 40),
    );
    setDiagnosis({ data: result.data, source: result.source, note: result.note });
    setDiagnosing(false);
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-ink3 mt-0.5">Where your marks are, and where the next ones come from.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Cards reviewed" value={totals.reviews} sub="all time" />
        <StatTile
          label="Question accuracy"
          value={`${Math.round(totals.accuracy * 100)}%`}
          sub={`${store.attempts.length} marked answers`}
          tone={totals.accuracy >= 0.7 ? "success" : totals.accuracy >= 0.5 ? "review" : "danger"}
        />
        <StatTile label="Topics secure" value={totals.mastered} sub={`of ${store.mastery.length}`} />
        <StatTile label="Level" value={level.level} sub={`${level.into}/${level.needed} XP to next`} />
      </div>

      <RetentionMasteryPanel />

      <section>
        <SectionHeading
          title="Predicted grades"
          hint="A working estimate, with the evidence, range and next lever kept visible."
        />
        <ul className="grid sm:grid-cols-2 gap-3">
          {store.predictions.map((prediction) => (
            <PredictedGradeCard
              key={prediction.subjectId}
              prediction={prediction}
              subjectName={getSubject(prediction.subjectId)?.name ?? prediction.subjectId}
              markedAnswers={store.attempts.filter((attempt) => attempt.subjectId === prediction.subjectId).length}
              topicTitle={(topicId) => getTopic(topicId)?.title ?? topicId}
            />
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          title="Weakest topics"
          hint="Ranked by mastery. These are where revision time converts into marks fastest."
          action={
            <Button size="sm" onClick={() => void diagnose()} disabled={diagnosing}>
              {diagnosing ? "Diagnosing…" : "Diagnose weaknesses"}
            </Button>
          }
        />
        {weak.length ? (
          <ul className="card divide-y divide-line">
            {weak.map((row) => {
              const topic = getTopic(row.topicId);
              return (
                <li key={row.topicId} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{topic?.title}</p>
                    <p className="text-[11px] text-ink3">
                      {getSubject(row.subjectId)?.name} · {row.cardsTotal} cards · {row.attempts} marked answers
                    </p>
                    <div className="mt-1.5 max-w-xs">
                      <ProgressBar value={row.mastery} tone={row.mastery < 0.4 ? "danger" : "review"} />
                    </div>
                  </div>
                  <Link href={`/practice?topic=${encodeURIComponent(row.topicId)}`}>
                    <Button size="sm">Practise</Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Panel>
            <p className="text-sm text-ink3">
              Nothing is flagged as weak. That usually means there is not enough marked work yet rather than that
              everything is secure — do a set of exam questions in each subject to give the engine something to
              measure.
            </p>
          </Panel>
        )}

        {diagnosis ? (
          <Panel className="mt-3 fade-in">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-semibold">{diagnosis.data.headline}</p>
              <SourceBadge source={diagnosis.source} note={diagnosis.note} />
            </div>
            <RichText>{diagnosis.data.findings.map((f) => `- ${f}`).join("\n")}</RichText>
            <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mt-4 mb-1.5">This week</p>
            <RichText>{diagnosis.data.actions.map((a) => `- ${a}`).join("\n")}</RichText>
          </Panel>
        ) : null}
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div>
          <SectionHeading title="Review forecast" hint="Cards falling due over the next fortnight." />
          <Panel>
            <div className="flex items-end gap-1 h-24">
              {forecast.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className={cx("w-full rounded-t-[3px] bar-anim", day.count ? "bg-accent" : "bg-surface2")}
                    style={{ height: `${Math.max(2, (day.count / maxDue) * 100)}%` }}
                    title={`${day.date}: ${day.count} due`}
                  />
                  <span className="text-[9px] text-ink3 tabular-nums">{day.date.slice(8)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink3 mt-3">
              Peaks are normal — FSRS clusters reviews where memory is about to decay. Clearing them daily keeps the
              peaks small.
            </p>
          </Panel>
        </div>

        <div>
          <SectionHeading title="Mistake patterns" hint="Classified from the marks you drop." />
          {patterns.length ? (
            <ul className="card divide-y divide-line">
              {patterns.map((pattern) => (
                <li key={pattern.category} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Pill tone="danger">{pattern.category}</Pill>
                    <span className="text-xs text-ink3 tabular-nums">{pattern.count} open</span>
                  </div>
                  <p className="text-xs text-ink2 mt-1.5">{pattern.insight}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Panel>
              <p className="text-sm text-ink3">
                No open mistakes. Every dropped mark you have logged has been re-answered correctly since.
              </p>
            </Panel>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title="Mastery by subject" hint="Every topic in the specification." />
        <div className="space-y-4">
          {subjects.map((subject) => {
            const rows = topicsFor(subject.id);
            const byId = new Map(store.mastery.map((m) => [m.topicId, m]));
            return (
              <Panel key={subject.id}>
                <p className="text-sm font-semibold mb-3">{subject.name}</p>
                <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2">
                  {rows.map((topic) => {
                    const mastery = byId.get(topic.id)?.mastery ?? 0;
                    return (
                      <li key={topic.id}>
                        <Link href={`/library?topic=${encodeURIComponent(topic.id)}`} className="block group">
                          <div className="flex justify-between gap-2 text-xs mb-1">
                            <span className="text-ink2 truncate group-hover:text-ink">{topic.title}</span>
                            <span className="text-ink3 tabular-nums shrink-0">{Math.round(mastery * 100)}%</span>
                          </div>
                          <ProgressBar
                            value={mastery}
                            tone={mastery >= 0.8 ? "success" : mastery >= 0.55 ? "accent" : mastery > 0 ? "review" : "danger"}
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <ExpectedMarksCard />
        <MarksLostByCause />
        <RecurringMisconceptions />
        <MistakeRootCausePanel />
        <DifficultyAndSubtopics />
        <PaperSimulationCard />
        <CalibrationCard />
        <ResponseTimeCalibrationPanel compact />
      </section>

      <section>
        <CoverageCard />
      </section>

      <section>
        <SectionHeading title="Achievements" hint="For showing up and repairing mistakes — not for volume." />
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = store.streak.achievements.includes(achievement.id);
            return (
              <li
                key={achievement.id}
                className={cx("card p-3", !unlocked && "opacity-50")}
              >
                <p className="text-sm font-medium text-ink">{achievement.name}</p>
                <p className="text-[11px] text-ink3">{achievement.description}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
