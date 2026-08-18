"use client";

import { useMemo } from "react";
import { getSubject, getTopic } from "@/domain/curriculum";
import { planForDate } from "@/domain/planner";
import { formatTime } from "@/domain/planner";
import { ACTIVITY_BLURB, ACTIVITY_LABEL, daysToExam } from "@/domain/recommender";
import { todayIso } from "@/domain/scheduling";
import { levelFor } from "@/domain/gamification";
import { useStore } from "@/state/store";
import { formatMinutes, recommendationHref, relativeDay } from "@/lib/activity";
import { ExpectedMarksCard } from "@/components/AssessmentPanels";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ResumeRevisionCard } from "@/components/ResumeRevisionCard";
import { Button, ButtonLink, EmptyState, Panel, Pill, ProgressBar, SectionHeading, StatTile } from "@/components/ui";

// The whole product in one screen: what to do next, why, and how long it takes.
// Everything below the primary card is context for overriding that choice —
// never a competing call to action.

export default function TodayPage() {
  const store = useStore();
  const today = todayIso();
  const { recommendations, dueCards, mistakes, predictions, streak, plannedSessions, settings } = store;

  const [primary, ...alternatives] = recommendations;
  const todaysPlan = useMemo(() => planForDate(plannedSessions, today), [plannedSessions, today]);
  const openMistakes = mistakes.filter((m) => !m.resolved).length;
  const level = levelFor(streak.xp);

  const nextExam = useMemo(() => {
    const upcoming = store.examDates.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [store.examDates, today]);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {greeting()}, {settings.displayName}
        </h1>
        <p className="text-sm text-ink3 mt-1">
          {primary
            ? "Here is the single highest-value thing you can do right now."
            : "Nothing is due. Add an exam date and the planner will build your week."}
        </p>
      </header>

      <ResumeRevisionCard />

      {primary ? (
        <RecommendationCard recommendation={primary} variant="primary" />
      ) : (
        <EmptyState
          title="No revision queued"
          body="Set your exam dates and available study time, then the planner builds an adaptive timetable and the engine starts recommending work."
          action={
            <ButtonLink href="/settings" variant="primary">
              Set up exams
            </ButtonLink>
          }
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Cards due"
          value={dueCards.length}
          sub={dueCards.length ? "Spaced repetition is time-sensitive" : "All clear"}
          tone={dueCards.length > 40 ? "review" : undefined}
        />
        <StatTile
          label="Open mistakes"
          value={openMistakes}
          sub={openMistakes ? "Marks you have already lost once" : "Nothing outstanding"}
          tone={openMistakes > 5 ? "danger" : undefined}
        />
        <StatTile
          label="Streak"
          value={streak.current}
          sub={`Longest ${streak.longest} · Level ${level.level}`}
          tone={streak.current >= 7 ? "success" : undefined}
        />
        <StatTile
          label="Next exam"
          value={nextExam ? `${daysToExam(store.examDates, nextExam.subjectId, today) ?? 0}d` : "—"}
          sub={nextExam ? `${getSubject(nextExam.subjectId)?.name} ${relativeDay(nextExam.date, today)}` : "No date set"}
        />
      </div>

      {store.assessment ? (
        <section>
          <ExpectedMarksCard />
        </section>
      ) : null}

      {alternatives.length ? (
        <section>
          <SectionHeading
            title="Other options"
            hint="Ranked by expected marks gained per minute. You can always override the engine."
          />
          <ul className="grid sm:grid-cols-2 gap-3">
            {alternatives.slice(0, 4).map((rec) => (
              <li key={`${rec.activity}:${rec.subjectId}:${rec.topicId ?? ""}`}>
                <RecommendationCard recommendation={rec} variant="secondary" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid lg:grid-cols-2 gap-5">
        <div>
          <SectionHeading
            title="Today's plan"
            hint={todaysPlan.length ? "Missed blocks reschedule themselves." : undefined}
            action={
              <ButtonLink href="/planner" size="sm" variant="ghost">
                Open planner
              </ButtonLink>
            }
          />
          {todaysPlan.length ? (
            <ul className="card divide-y divide-line">
              {todaysPlan.map((session) => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs tabular-nums text-ink3 w-11">{formatTime(session.startMinute)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">
                      {ACTIVITY_LABEL[session.activity]}
                      {session.topicId ? ` · ${getTopic(session.topicId)?.title}` : ""}
                    </p>
                    <p className="text-[11px] text-ink3 truncate">{getSubject(session.subjectId)?.name}</p>
                  </div>
                  {session.status === "done" ? (
                    <Pill tone="success">Done</Pill>
                  ) : (
                    <span className="text-[11px] text-ink3">{formatMinutes(session.minutes)}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No plan for today"
              body="Generate an adaptive timetable from your exam dates, available hours and current mastery."
              action={
                <Button onClick={() => void store.regeneratePlan()}>
                  Build my plan
                </Button>
              }
            />
          )}
        </div>

        <div>
          <SectionHeading title="Predicted grades" hint="Confidence rises as you complete marked work." />
          <ul className="card divide-y divide-line">
            {predictions.map((prediction) => (
              <li key={prediction.subjectId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-ink">{getSubject(prediction.subjectId)?.name}</p>
                  <p className="text-lg font-semibold tabular-nums">{prediction.grade}</p>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={prediction.percent / 100} />
                </div>
                <p className="text-[11px] text-ink3 mt-1.5">
                  {prediction.percent}% · range {prediction.worstCase}–{prediction.bestCase} · confidence{" "}
                  {Math.round(prediction.confidence * 100)}%
                  {prediction.trend !== 0 ? ` · ${prediction.trend > 0 ? "+" : ""}${prediction.trend}pp this month` : ""}
                </p>
              </li>
            ))}
            {!predictions.length ? (
              <li className="px-4 py-6 text-sm text-ink3 text-center">Pick your subjects in settings.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}
