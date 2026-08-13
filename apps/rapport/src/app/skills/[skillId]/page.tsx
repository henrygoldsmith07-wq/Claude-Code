"use client";

import Link from "next/link";
import { use, useState } from "react";
import { dependentsOf, getSkill, prerequisitesOf } from "@/domain/skills";
import { confidenceGap, describeState, stateIsConfident } from "@/domain/mastery";
import { scheduleFor } from "@/domain/scheduling";
import { lessonFor } from "@/domain/lessons";
import { scenariosForSkill } from "@/domain/scenarios";
import { challengesForSkill } from "@/domain/challenges";
import { Badge, Button, Card, Evidence, Hedged, Meter, PageHeader } from "@/components/ui";
import { LessonPanel } from "@/components/lesson-panel";
import { useStore } from "@/state/store";

// ---------------------------------------------------------------------------
// One skill.
//
// Shows what the app currently believes, how sure it is, and the graph around
// it — and lets the user overwrite the estimate. That last part matters: a
// system that tells someone they are "developing" at expressing opinions, with
// no way to argue back, is making a claim about them that it cannot support.
// ---------------------------------------------------------------------------

export default function SkillPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const store = useStore();
  const [showLesson, setShowLesson] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const id = decodeURIComponent(skillId);
  const skill = getSkill(id);
  const state = store.states.find((item) => item.skillId === id);

  if (!skill) {
    return (
      <>
        <PageHeader title="Unknown skill" />
        <Link href="/skills" className="text-sm underline">Back to skills</Link>
      </>
    );
  }

  const schedule = state ? scheduleFor(state, new Date().toISOString()) : null;
  const gap = state ? confidenceGap(state) : 0;
  const scenarios = scenariosForSkill(id);
  const challenges = challengesForSkill(id);
  const prerequisites = prerequisitesOf(id);
  const unlocks = dependentsOf(id);

  return (
    <>
      <Link href="/skills" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
        All skills
      </Link>
      <PageHeader title={skill.name} subtitle={skill.summary} />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{state ? describeState(state) : "not started"}</Badge>
          <Badge>Base difficulty {skill.baseDifficulty}/5</Badge>
          {state && state.attemptCount > 0 ? <Badge>{state.attemptCount} sessions</Badge> : null}
        </div>

        {state ? (
          <div className="mt-4 space-y-4">
            <Meter
              value={state.mastery}
              uncertainty={state.masteryUncertainty}
              label="What you do"
              sublabel={stateIsConfident(state) ? undefined : "wide estimate — little evidence yet"}
            />
            <Meter
              value={state.confidence}
              uncertainty={state.confidenceUncertainty}
              label="How it feels"
              sublabel={Math.abs(gap) > 0.15 ? (gap < 0 ? "lags the behaviour" : "ahead of the behaviour") : undefined}
            />
            {schedule && state.attemptCount > 0 ? (
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Estimated retention {Math.round(schedule.retention * 100)}%
                {schedule.due ? " — worth revisiting" : ` — next useful around ${schedule.dueOn}`}.
              </p>
            ) : null}
          </div>
        ) : null}

        {state && Math.abs(gap) > 0.15 ? (
          <Hedged>
            {gap < 0
              ? "You are doing this better than it feels. That gap usually closes with real attempts rather than more rehearsal."
              : "This feels more settled than the evidence shows so far — worth trying a harder version to check."}
          </Hedged>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowLesson((value) => !value)}>
            {showLesson ? "Hide" : "Read"} the principle
          </Button>
          {scenarios[0] ? (
            <Link href={`/practise/${encodeURIComponent(scenarios[0].id)}`}>
              <Button size="sm" variant="secondary">Practise it</Button>
            </Link>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => store.setFocus(id)}>
            Make this today&apos;s focus
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCorrecting((value) => !value)}>
            This estimate is wrong
          </Button>
        </div>
      </Card>

      {correcting ? (
        <Card className="mt-4">
          <h3 className="text-base font-semibold">Correct the estimate</h3>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            Your assessment takes priority for the next couple of weeks. Practice evidence will refine it from there.
          </p>
          <div className="mt-4 space-y-4">
            <CorrectionRow
              label="How well do you actually do this?"
              onPick={(value) => void store.correctSkill(id, { mastery: value })}
            />
            <CorrectionRow
              label="How comfortable does it feel?"
              onPick={(value) => void store.correctSkill(id, { confidence: value })}
            />
          </div>
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={() => setCorrecting(false)}>Done</Button>
          </div>
        </Card>
      ) : null}

      {showLesson ? (
        <div className="mt-4">
          <LessonPanel lesson={lessonFor(id)} onDone={() => setShowLesson(false)} />
        </div>
      ) : null}

      <Card className="mt-4">
        <h3 className="text-base font-semibold">What this looks like</h3>
        <Evidence items={skill.behaviours} />
      </Card>

      {prerequisites.length > 0 ? (
        <Card className="mt-4">
          <h3 className="text-base font-semibold">Builds on</h3>
          <ul className="mt-2 space-y-2">
            {prerequisites.map((dep) => {
              const required = getSkill(dep.requires);
              const requiredState = store.states.find((item) => item.skillId === dep.requires);
              const met = (requiredState?.mastery ?? 0) >= dep.minMastery;
              return (
                <li key={dep.requires} className="text-sm">
                  <Link href={`/skills/${encodeURIComponent(dep.requires)}`} className="font-medium underline">
                    {required?.name ?? dep.requires}
                  </Link>
                  {met ? null : <Badge tone="warn">worth strengthening first</Badge>}
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{dep.rationale}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {unlocks.length > 0 ? (
        <Card className="mt-4">
          <h3 className="text-base font-semibold">Makes these easier</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unlocks.map((dep) => (
              <li key={dep.skill}>
                <Link href={`/skills/${encodeURIComponent(dep.skill)}`}>
                  <Badge>{getSkill(dep.skill)?.name ?? dep.skill}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {challenges.length > 0 ? (
        <Card className="mt-4">
          <h3 className="text-base font-semibold">Real-world challenges</h3>
          <ul className="mt-2 space-y-2">
            {challenges.map((challenge) => (
              <li key={challenge.id} className="text-sm">
                <span className="font-medium">{challenge.objective}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-faint)" }}>level {challenge.difficulty}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => void store.assignChallenge(id)}>
              Take one today
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function CorrectionRow({ label, onPick }: { label: string; onPick: (value: number) => void }) {
  const options = [
    { label: "Developing", value: 0.25 },
    { label: "Functional", value: 0.5 },
    { label: "Strong", value: 0.72 },
    { label: "Advanced", value: 0.9 },
  ];
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option.label} size="sm" variant="secondary" onClick={() => onPick(option.value)}>
            {option.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
