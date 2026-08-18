"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { aiDiagnose } from "@/ai/client";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { ACHIEVEMENTS, levelFor } from "@/domain/gamification";
import { weakTopics } from "@/domain/mastery";
import { mistakePatterns } from "@/domain/mistakes";
import { remediationForMistake } from "@/domain/remediation";
import { dueCountByDay, todayIso } from "@/domain/scheduling";
import type { DiagnoseResponse } from "@/ai/types";
import { useStore, useSubjects } from "@/state/store";
import { RichText } from "@/components/RichText";
import { CalibrationCard, DifficultyAndSubtopics, ExpectedMarksCard, MarksLostByCause, PaperSimulationCard } from "@/components/AssessmentPanels";
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
  const openMistakes = useMemo(
    () =>
      store.mistakes
        .filter((mistake) => !mistake.resolved)
        .slice()
        .sort((a, b) => b.marksLost - a.marksLost || b.createdAt.localeCompare(a.createdAt)),
    [store.mistakes],
  );
  const patterns = useMemo(() => mistakePatterns(openMistakes), [openMistakes]);
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

      <section>
        <SectionHeading
          title="Mistake → remediation → retest"
          hint="Each dropped mark has a specific next action. Retest the same point until it is secure."
        />
        {openMistakes.length ? (
          <ul className="card divide-y divide-line">
            {openMistakes.slice(0, 8).map((mistake) => {
              const question = mistake.questionId
                ? store.questions.find((candidate) => candidate.id === mistake.questionId)
                : undefined;
              const attempt = mistake.attemptId
                ? store.attempts.find((candidate) => candidate.id === mistake.attemptId)
                : undefined;
              const remediation = question
                ? remediationForMistake(mistake, question, attempt, getTopic(mistake.topicId))
                : null;
              return (
                <li key={mistake.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="danger">{mistake.category}</Pill>
                        <span className="text-[11px] text-ink3 tabular-nums">
                          {mistake.marksLost} mark(s) lost
                        </span>
                        {(mistake.retestCount ?? 0) > 0 ? (
                          <span className="text-[11px] text-ink3 tabular-nums">
                            {mistake.retestCount} retest{mistake.retestCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-ink mt-1.5">{mistake.description}</p>
                      {remediation ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-ink2">
                            <span className="font-semibold">Remediation:</span> {remediation.action}
                          </p>
                          <p className="text-[11px] text-ink3">Evidence: {remediation.evidence}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink3 mt-2">
                          Revisit the mark-scheme point, then retest the source question.
                        </p>
                      )}
                    </div>
                    {question ? (
                      <Link href={`/practice?retest=${encodeURIComponent(mistake.id)}`} className="shrink-0">
                        <Button size="sm" variant="primary">
                          Retest
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-ink3">Source unavailable</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Panel>
            <p className="text-sm text-ink3">
              No open mistakes. A dropped mark will appear here with its remediation and retest link.
            </p>
          </Panel>
        )}
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
        <DifficultyAndSubtopics />
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
