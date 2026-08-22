"use client";

import Link from "next/link";
import { useState } from "react";
import { buildTrainingGuidance, challengeReminder } from "@/domain/training";
import { focusHistoryFrom, recentEvidence } from "@/domain/events";
import { getSkill } from "@/domain/skills";
import { Badge, Button, Card, Evidence, Hedged } from "@/components/ui";
import { useNow } from "@/state/clock";
import { useStore } from "@/state/store";

/**
 * The adaptive part of Training in one place. The card is intentionally an
 * explanation surface as well as a control surface: every adjustment has a
 * visible reason and none requires an AI provider.
 */
export function TrainingPlan() {
  const store = useStore();
  const now = useNow();
  const [exerciseDone, setExerciseDone] = useState(false);
const [recording, setRecording] = useState(false);
  if (!store.ready) return null;

  const focusSkillId = store.todayPlan?.session.focusSkillId ?? store.states[0]?.skillId;
  if (!focusSkillId) return null;

  const skill = getSkill(focusSkillId);
  const evidence = recentEvidence(store.events).filter((item) => item.skillId === focusSkillId);
  const guidance = buildTrainingGuidance({
    skillId: focusSkillId,
    states: store.states,
    recentScenarioIds: store.simulations.slice(-6).map((simulation) => simulation.scenarioId),
    recentPerformances: evidence.map((item) => item.performance),
    evaluations: store.evaluations,
    focusHistory: focusHistoryFrom(store.events, store.user?.timezoneOffsetMinutes ?? 0),
    now,
    preferenceAssistLevel: store.preference.assistLevel,
  });
  const openChallenge = store.attempts.find((attempt) => !attempt.completedAt && !attempt.skippedAt);
  const reminder = openChallenge ? challengeReminder(openChallenge, now) : null;

  if (!guidance) return null;

  return (
    <Card as="section" className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Training controls</Badge>
        {skill ? <Badge>{skill.name}</Badge> : null}
      </div>
      <h2 className="mt-3 text-lg font-semibold">The next exposure adapts to your evidence</h2>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        The loop fades support, recycles repeated errors and leaves a gap before checking whether a skill transfers.
        You can always choose another situation.
      </p>

      <section className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--accent)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={guidance.stage.stage === "delayed-retest" ? "warn" : "accent"}>{guidance.stage.label}</Badge>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Current training stage</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{guidance.stage.reason}</p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{guidance.stage.next}</p>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <section className="rounded-[10px] border p-4" style={{ borderColor: "var(--border)" }}>
          <Badge>Assistance fading</Badge>
          <h3 className="mt-2 text-sm font-semibold">{guidance.assistance.label}</h3>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {guidance.assistance.summary}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>{guidance.assistance.next}</p>
        </section>

        <section className="rounded-[10px] border p-4" style={{ borderColor: "var(--border)" }}>
          <Badge tone="accent">Adaptive scenario</Badge>
          {guidance.scenario ? (
            <>
              <h3 className="mt-2 text-sm font-semibold">{guidance.scenario.scenario.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>Difficulty {guidance.scenario.difficulty}/5</Badge>
                <Badge>{selectionLabel(guidance.scenario.selection)}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {guidance.scenario.reason}
              </p>
              <div className="mt-3">
                <Link href={`/practise/${encodeURIComponent(guidance.scenario.scenario.id)}`}>
                  <Button size="sm">Start this situation</Button>
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Build a situation from the practice description below to add a personalised scenario.
            </p>
          )}
        </section>
      </div>

      {guidance.recurringError ? (
        <section className="mt-3 rounded-[10px] border p-4" style={{ borderColor: "var(--warn)" }}>
          <Badge tone="warn">Recurring error recycled</Badge>
          <h3 className="mt-2 text-sm font-semibold">{guidance.recurringError.message}</h3>
          <p className="mt-2 text-sm leading-relaxed">{guidance.recurringError.exercise.prompt}</p>
          <Evidence items={guidance.recurringError.exercise.criteria} />
          {exerciseDone ? (
            <p className="mt-3 text-xs" style={{ color: "var(--accent)" }}>Recycled exercise recorded.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={recording}
                onClick={async () => {
                  setRecording(true);
                  try {
                    await store.recordExercise(guidance.recurringError!.exercise, 0.7);
                    setExerciseDone(true);
                  } finally {
                    setRecording(false);
                  }
                }}
              >
                I practised it
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={recording}
                onClick={async () => {
                  setRecording(true);
                  try {
                    await store.recordExercise(guidance.recurringError!.exercise, 0.9);
                    setExerciseDone(true);
                  } finally {
                    setRecording(false);
                  }
                }}
              >
                It felt solid
              </Button>
            </div>
          )}
        </section>
      ) : null}

      <div className="mt-3 space-y-3">
        {guidance.prerequisite ? (
          <div className="rounded-[10px] border p-4" style={{ borderColor: "var(--border)" }}>
            <Badge>Prerequisite route</Badge>
            <p className="mt-2 text-sm leading-relaxed">
              Build <Link className="font-medium underline" href={`/skills/${encodeURIComponent(guidance.prerequisite.requiredSkillId)}`}>
                {guidance.prerequisite.requiredSkillName}
              </Link> first. {guidance.prerequisite.rationale}
            </p>
          </div>
        ) : null}

        {guidance.maintenance.due || guidance.retest ? (
          <div className="rounded-[10px] border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap gap-2">
              {guidance.maintenance.due ? <Badge tone="accent">Maintenance practice</Badge> : null}
              {guidance.retest ? <Badge tone={guidance.retest.due ? "warn" : "neutral"}>{guidance.retest.due ? "Retest due" : "Delayed retest"}</Badge> : null}
            </div>
            {guidance.maintenance.due ? <p className="mt-2 text-sm">{guidance.maintenance.message}</p> : null}
            {guidance.retest ? <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{guidance.retest.message}</p> : null}
          </div>
        ) : null}

        {guidance.overpractice.isOverpractised ? (
          <Hedged label="Overpractice check">{guidance.overpractice.message}</Hedged>
        ) : null}

        {reminder ? (
          <section className="rounded-[10px] border p-4" style={{ borderColor: reminder.due ? "var(--accent)" : "var(--border)" }}>
            <Badge tone={reminder.due ? "accent" : "neutral"}>{reminder.label}</Badge>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{reminder.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reminder.due ? (
                <Button size="sm" variant="secondary" onClick={() => void store.postponeChallenge(openChallenge!.id, 1)}>
                  Remind me tomorrow
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => void store.postponeChallenge(openChallenge!.id, 0)}>
                  Bring it back today
                </Button>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </Card>
  );
}

function selectionLabel(selection: "personalised" | "error-recycle" | "maintenance" | "retest"): string {
  switch (selection) {
    case "error-recycle":
      return "Error recycle";
    case "maintenance":
      return "Maintenance";
    case "retest":
      return "Delayed retest";
    default:
      return "Personalised";
  }
}

