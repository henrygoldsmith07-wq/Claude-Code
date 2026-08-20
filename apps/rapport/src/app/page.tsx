"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { useStore } from "@/state/store";
import { getSkill } from "@/domain/skills";
import { estimatedMinutes, homeSummary } from "@/domain/session";
import { consistency } from "@/domain/progress";
import { streakMessage } from "@/domain/gamification";
import { stateFor } from "@/domain/mastery";
import { challengeReminder } from "@/domain/training";
import { behaviourLabel } from "@/domain/behaviours";
import { Badge, Button, Card, Evidence, PageHeader, Skeleton } from "@/components/ui";
import { LessonPanel } from "@/components/lesson-panel";
import { ReflectionForm } from "@/components/reflection-form";
import { useNow } from "@/state/clock";

// ---------------------------------------------------------------------------
// Today.
//
// The screen answers three questions in order, and nothing else appears above
// them: what am I practising, why, and what do I do next. Everything else on
// this page is below the fold by design.
// ---------------------------------------------------------------------------

export default function TodayPage() {
  const store = useStore();
  const now = useNow();
  const { todayPlan, ready, states, attempts } = store;
  const [openLesson, setOpenLesson] = useState(false);
  const [reflectingOn, setReflectingOn] = useState<string | null>(null);
  const [challengeAttemptId, setChallengeAttemptId] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!todayPlan) {
    return (
      <>
        <PageHeader title="Today" />
        <Card>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Setting up your first session. If this persists, your profile may not have been created —{" "}
            <Link href="/onboarding" className="underline">start onboarding</Link>.
          </p>
        </Card>
      </>
    );
  }

  const state = states.find((item) => item.skillId === todayPlan.session.focusSkillId);
  const summary = homeSummary(todayPlan, state);
  const skill = getSkill(todayPlan.session.focusSkillId);
  const openAttempt = attempts.find((item) => !item.completedAt && !item.skippedAt);
  const reminder = openAttempt ? challengeReminder(openAttempt, now) : null;
  const streak = consistency(store.events, new Date().toISOString());

  const startChallenge = async () => {
    const attempt = openAttempt ?? (await store.assignChallenge(todayPlan.session.focusSkillId));
    setChallengeAttemptId(attempt.id);
  };

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={`${estimatedMinutes(todayPlan.session)} minutes of app time, plus one thing to try in a real conversation.`}
      />

      {/* 1. What am I practising · 2. Why · 3. What next */}
      <Card className="rise">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Today&apos;s focus</Badge>
          {todayPlan.trainingStage ? <Badge>{todayPlan.trainingStage.label}</Badge> : null}
          {state && state.attemptCount > 0 ? <Badge>{stateFor(state.mastery)}</Badge> : <Badge>New</Badge>}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{summary.practising}</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {summary.why}
        </p>
        {skill ? (
          <p className="mt-3 text-sm leading-relaxed">{skill.summary}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {todayPlan.lesson && !openLesson ? (
            <Button onClick={() => setOpenLesson(true)}>
              {summary.next} <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : todayPlan.scenario ? (
            <Link href={`/practise/${encodeURIComponent(todayPlan.scenario.id)}`}>
              <Button>
                Start the practice conversation <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </Link>
          ) : null}
          <Link href={`/skills/${encodeURIComponent(todayPlan.session.focusSkillId)}`}>
            <Button variant="secondary">Why this skill?</Button>
          </Link>
        </div>
      </Card>

      {openLesson && todayPlan.lesson ? (
        <div className="mt-4">
          <LessonPanel
            lesson={todayPlan.lesson}
            onDone={async () => {
              await store.recordLessonRead(todayPlan.session.focusSkillId, todayPlan.lesson!.id);
              setOpenLesson(false);
            }}
          />
        </div>
      ) : null}

      {/* Practise */}
      {todayPlan.scenario ? (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">Practise · {todayPlan.scenario.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {todayPlan.scenario.context}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>Difficulty {todayPlan.scenario.difficulty}/5</Badge>
                {todayPlan.assistLevel !== "none" ? <Badge>Hints: {todayPlan.assistLevel}</Badge> : <Badge tone="accent">No hints</Badge>}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link href={`/practise/${encodeURIComponent(todayPlan.scenario.id)}`}>
              <Button variant="secondary">Open</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Apply */}
      {todayPlan.challenge ? (
        <Card className="mt-4">
          <h3 className="text-base font-semibold">Apply · a real conversation</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {todayPlan.challenge.challenge.behaviour ? (
              <Badge tone="accent">Target: {behaviourLabel(todayPlan.challenge.challenge.behaviour)}</Badge>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Why this mission: {todayPlan.challenge.reason}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">{todayPlan.challenge.objectiveText}</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {todayPlan.challenge.challenge.context}
          </p>
          <Evidence items={todayPlan.challenge.challenge.completionCriteria} />

          <div className="mt-4 flex flex-wrap gap-2">
            {challengeAttemptId || openAttempt ? (
              <Button onClick={() => setReflectingOn(challengeAttemptId ?? openAttempt?.id ?? null)}>
                <Check size={16} aria-hidden="true" /> Log how it went
              </Button>
            ) : (
              <Button onClick={startChallenge}>Take this one</Button>
            )}
            {openAttempt ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  const next = await store.swapChallenge(openAttempt.id);
                  setChallengeAttemptId(next?.id ?? null);
                }}
              >
                <RefreshCw size={15} aria-hidden="true" /> Swap
              </Button>
            ) : null}
            {openAttempt ? (
              <Button variant="ghost" onClick={() => store.skipChallenge(openAttempt.id, "not today")}>
                <X size={15} aria-hidden="true" /> Not today
              </Button>
            ) : null}
            {openAttempt && reminder ? (
              <Button
                variant="ghost"
                onClick={() => void store.postponeChallenge(openAttempt.id, reminder.due ? 1 : 0)}
              >
                {reminder.due ? "Remind me tomorrow" : "Bring it back today"}
              </Button>
            ) : null}
          </div>
          {reminder ? (
            <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
              {reminder.label}. {reminder.detail}
            </p>
          ) : null}
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Swapping and skipping cost nothing — they tell the app which challenges suit you, and are never counted against you.
          </p>
        </Card>
      ) : null}

      {reflectingOn ? (
        <div className="mt-4">
          <ReflectionForm
            attemptId={reflectingOn}
            onDone={() => {
              setReflectingOn(null);
              setChallengeAttemptId(null);
            }}
          />
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        {streakMessage(streak.currentStreak, streak.activeDays)}
      </p>
    </>
  );
}

