"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getSubject, getTopic } from "@/domain/curriculum";
import { planForDate } from "@/domain/planner";
import { todayIso } from "@/domain/scheduling";
import { useStore } from "@/state/store";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ResumeRevisionCard } from "@/components/ResumeRevisionCard";
import { ButtonLink, EmptyState, Pill } from "@/components/ui";
import { activityHref } from "@/lib/activity";

// The whole product in one screen: what to do next, why, and how long it takes.
// Everything below the primary card is context for overriding that choice —
// never a competing call to action.

export default function TodayPage() {
  const store = useStore();
  const today = todayIso();
  const { recommendations, dueCards, mistakes, streak, plannedSessions, settings } = store;

  const [primary] = recommendations;
  const todaysPlan = useMemo(() => planForDate(plannedSessions, today), [plannedSessions, today]);
  const completedPlan = todaysPlan.filter((session) => session.status === "done").length;
  const openMistakes = mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Today</p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-1">
          {greeting()}, {settings.displayName}
        </h1>
        <p className="text-sm text-ink3 mt-1">
          {primary
            ? "One useful next step."
            : "Nothing is queued yet. Set an exam date to get started."}
        </p>
      </header>

      <ResumeRevisionCard />

      {primary ? (
        <RecommendationCard recommendation={primary} variant="primary" compact />
      ) : (
        <EmptyState
          title="No revision queued"
          body="Set an exam date and available study time. Revise will choose your next best task."
          action={
            <ButtonLink href="/settings" variant="primary">
              Set up exams
            </ButtonLink>
          }
        />
      )}

      <div className="card grid grid-cols-2 sm:grid-cols-4" aria-label="Today status">
        <StatusLink href="/review" label="Due" value={dueCards.length} note={dueCards.length ? "cards" : "clear"} />
        <StatusLink href="/review?mode=mistakes" label="Mistakes" value={openMistakes} note={openMistakes ? "to fix" : "clear"} />
        <StatusLink
          href="/planner"
          label="Plan"
          value={todaysPlan.length ? `${completedPlan}/${todaysPlan.length}` : "—"}
          note={todaysPlan.length ? "done" : "not set"}
        />
        <StatusLink
          href="/progress"
          label="Streak"
          value={streak.current}
          note={streak.current === 1 ? "day" : "days"}
        />
      </div>

      {todaysPlan.length ? (
        <section className="card p-4" aria-labelledby="today-plan-heading">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 id="today-plan-heading" className="text-sm font-semibold text-ink">Today’s route</h2>
              <p className="text-xs text-ink3 mt-0.5">The next blocks adapt as your answers and mistakes come in.</p>
            </div>
            <Link href="/planner" className="text-xs text-accent hover:underline">Full plan →</Link>
          </div>
          <ol className="mt-3 divide-y divide-line">
            {todaysPlan.slice(0, 4).map((session) => {
              const topic = session.topicId ? getTopic(session.topicId) : null;
              const done = session.status === "done";
              return (
                <li key={session.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-5 text-xs tabular-nums text-ink3">{todaysPlan.indexOf(session) + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={done ? "text-sm text-ink3 line-through" : "text-sm text-ink"}>
                      {session.activity.replace(/-/g, " ")}{topic ? ` · ${topic.title}` : ""}
                    </p>
                    <p className="text-[11px] text-ink3 truncate">
                      {getSubject(session.subjectId)?.name} · {session.purpose ?? session.reason}
                    </p>
                  </div>
                  {session.priority ? <Pill tone={session.priority === "critical" ? "danger" : session.priority === "high" ? "review" : "neutral"}>{session.priority}</Pill> : null}
                  {!done && session.status === "pending" ? (
                    <ButtonLink href={activityHref(session.activity, session.subjectId, session.topicId, session.id)} size="sm" variant="primary">
                      Start
                    </ButtonLink>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-line pt-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Need less time?</h2>
          <p className="text-xs text-ink3 mt-0.5">A short, marked sprint still counts.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/practice?quick=5" className="btn btn-secondary text-xs" aria-label="I have 5 minutes">
            5 min
          </Link>
          <Link href="/practice?quick=10" className="btn btn-secondary text-xs" aria-label="I have 10 minutes">
            10 min
          </Link>
        </div>
      </section>

      <nav aria-label="Today follow-up" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink3">
        <Link href="/planner" className="hover:text-ink hover:underline">Open full plan →</Link>
        <Link href="/progress" className="hover:text-ink hover:underline">View progress →</Link>
      </nav>
    </div>
  );
}

function StatusLink({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <Link href={href} className="p-3 sm:p-3.5 hover:bg-surface2 transition-colors first:border-l-0 border-line [&:nth-child(n+2)]:border-l [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0">
      <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-xl font-semibold tabular-nums text-ink">{value}</span>
        <span className="text-[11px] text-ink3">{note}</span>
      </div>
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}
