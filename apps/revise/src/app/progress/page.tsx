"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { aiDiagnose } from "@/ai/client";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { delayedFarTransferReport, delayedFarTransferRetests } from "@/domain/delayed-far-transfer";
import { ACHIEVEMENTS, levelFor } from "@/domain/gamification";
import { weakTopics } from "@/domain/mastery";
import { mistakePatterns } from "@/domain/mistakes";
import { markEscalationReport } from "@/domain/mark-escalation";
import { dueCountByDay, todayIso } from "@/domain/scheduling";
import type { DiagnoseResponse } from "@/ai/types";
import { useStore, useSubjects } from "@/state/store";
import { RichText } from "@/components/RichText";
import { CalibrationCard, DifficultyAndSubtopics, ExpectedMarksCard, MarksLostByCause, PaperSimulationCard, QuestionDiscriminationCard, TechniqueVsKnowledgeCard } from "@/components/AssessmentPanels";
import { CoverageCard } from "@/components/CoverageCard";
import { Button, Panel, Pill, ProgressBar, SectionHeading, SourceBadge, StatTile, cx } from "@/components/ui";

// Analytics that answer one question — where are the marks? — rather than
// showing every number the app happens to hold. Each panel ends in an action.

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
  const markReview = useMemo(() => {
    const report = markEscalationReport(store.attempts);
    const pending = store.attempts
      .filter((attempt) => attempt.markEscalation?.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { report, pending };
  }, [store.attempts]);
  const farTransfer = useMemo(() => {
    const retests = delayedFarTransferRetests({ attempts: store.attempts, questions: store.questions, today });
    return { retests, report: delayedFarTransferReport(retests) };
  }, [store.attempts, store.questions, today]);

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

      <section>
        <SectionHeading title="Mark review queue" hint="Low-confidence AI marks are held for a second-marker decision." />
        <Panel>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatTile
              label="Pending human review"
              value={markReview.pending.length}
              sub={markReview.pending.length ? "saved with the attempts below" : "No escalations waiting"}
              tone={markReview.pending.length ? "review" : "success"}
            />
            <StatTile label="AI marks" value={markReview.report.aiAttempts} sub={`${markReview.report.escalatedAttempts} escalated`} />
            <StatTile
              label="Escalation rate"
              value={markReview.report.escalationRate === null ? "—" : `${Math.round(markReview.report.escalationRate * 100)}%`}
              sub="of AI-marked attempts"
              tone={markReview.report.escalationRate !== null && markReview.report.escalationRate > 0 ? "review" : undefined}
            />
          </div>
          {markReview.pending.length ? (
            <ul className="mt-4 border-t border-line divide-y divide-line">
              {markReview.pending.slice(0, 5).map((attempt) => (
                <li key={attempt.id} className="py-2.5 flex items-start gap-3">
                  <Pill tone={attempt.markEscalation?.priority === "urgent" ? "danger" : "review"}>
                    {attempt.markEscalation?.priority ?? "review"}
                  </Pill>
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">
                      {store.questions.find((question) => question.id === attempt.questionId)?.stem ?? attempt.questionId}
                    </p>
                    <p className="text-[11px] text-ink3">
                      {attempt.markConfidence === undefined ? "Confidence unavailable" : `${Math.round(attempt.markConfidence * 100)}% confidence`} · {attempt.createdAt.slice(0, 10)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink3 mt-4 border-t border-line pt-3">
              AI marks below 60% confidence will appear here and remain labelled as provisional until reviewed.
            </p>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeading
          title="Delayed far-transfer"
          hint="A high-scoring answer earns a different-context question seven days later — a stronger test than repeating the same prompt."
        />
        <Panel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Due now"
              value={farTransfer.report.due}
              sub={farTransfer.report.due ? "open transfer checks" : "No checks waiting"}
              tone={farTransfer.report.due ? "review" : "success"}
            />
            <StatTile label="Upcoming" value={farTransfer.report.upcoming} sub="scheduled checks" />
            <StatTile label="Completed" value={farTransfer.report.completed} sub="separate transfer evidence" />
            <StatTile
              label="Transfer pass rate"
              value={farTransfer.report.passRate === null ? "—" : `${Math.round(farTransfer.report.passRate * 100)}%`}
              sub="60% counts as a pass"
              tone={farTransfer.report.passRate === null ? undefined : farTransfer.report.passRate >= 0.6 ? "success" : "danger"}
            />
          </div>
          {farTransfer.retests.length ? (
            <ul className="mt-4 border-t border-line divide-y divide-line">
              {farTransfer.retests.slice(0, 6).map((retest) => {
                const candidate = store.questions.find((question) => question.id === retest.candidateQuestionId);
                const source = store.questions.find((question) => question.id === retest.sourceQuestionId);
                const row = (
                  <>
                    <Pill tone={retest.status === "completed" ? (retest.outcome?.passed ? "success" : "danger") : retest.status === "due" ? "review" : "accent"}>
                      {retest.status === "completed"
                        ? `${Math.round((retest.outcome?.percentage ?? 0) * 100)}%`
                        : retest.status === "due"
                          ? "due"
                          : retest.scheduledFor}
                    </Pill>
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{candidate?.stem ?? retest.candidateQuestionId}</p>
                      <p className="text-[11px] text-ink3 truncate">
                        From {source?.stem ?? retest.sourceQuestionId} · {getTopic(retest.topicIds[0] ?? "")?.title ?? retest.subjectId}
                      </p>
                    </div>
                  </>
                );
                return (
                  <li key={retest.retestId} className="py-2.5 flex items-start gap-3">
                    {retest.status === "completed" ? row : <Link href={`/practice?retest=${encodeURIComponent(retest.retestId)}`} className="flex items-start gap-3 min-w-0 flex-1">{row}</Link>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-ink3 mt-4 border-t border-line pt-3">
              Score at least 80% on a mapped question and a new-context check will appear here for seven days later.
            </p>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeading
          title="Predicted grades"
          hint="Blends measured exam-question accuracy with topic coverage. Confidence rises with marked work."
        />
        <ul className="grid sm:grid-cols-2 gap-3">
          {store.predictions.map((prediction) => (
            <Panel as="li" key={prediction.subjectId}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{getSubject(prediction.subjectId)?.name}</p>
                <p className="text-2xl font-semibold tabular-nums">{prediction.grade}</p>
              </div>
              <div className="mt-2">
                <ProgressBar value={prediction.percent / 100} label={`${prediction.percent}%`} />
              </div>
              <p className="text-[11px] text-ink3 mt-2">
                Realistic range {prediction.worstCase}–{prediction.bestCase} · confidence{" "}
                {Math.round(prediction.confidence * 100)}%
                {prediction.trend !== 0 ? ` · ${prediction.trend > 0 ? "+" : ""}${prediction.trend}pp this month` : ""}
              </p>
              {prediction.headroom.length ? (
                <div className="mt-3 pt-3 border-t border-line">
                  <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-1.5">
                    Biggest gains available
                  </p>
                  <ul className="space-y-1">
                    {prediction.headroom.slice(0, 3).map((row) => (
                      <li key={row.topicId} className="flex justify-between gap-2 text-xs">
                        <span className="text-ink2 truncate">{getTopic(row.topicId)?.title}</span>
                        <span className="text-ink3 tabular-nums shrink-0">+{row.potentialPercent}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
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
        <TechniqueVsKnowledgeCard />
        <DifficultyAndSubtopics />
        <QuestionDiscriminationCard />
        <PaperSimulationCard />
        <CalibrationCard />
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
