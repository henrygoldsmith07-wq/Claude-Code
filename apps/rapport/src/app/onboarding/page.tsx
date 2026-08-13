"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ONBOARDING_QUESTIONS, buildInitialProfile, describeProfile } from "@/domain/assessment";
import { Badge, Button, Card, Field, TextArea } from "@/components/ui";
import { useStore } from "@/state/store";
import type { AssessmentAnswer } from "@/domain/types";

// ---------------------------------------------------------------------------
// Onboarding.
//
// One question per screen, seven screens, every one skippable. Each screen
// shows why it is being asked — a training app that quizzes people about their
// social difficulties without explaining what it does with the answers has got
// the relationship the wrong way round.
//
// The last screen shows the profile as guesses, and says outright that the
// first week will correct them. That framing is the point: nothing here is a
// verdict.
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const store = useStore();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [statement, setStatement] = useState("");
  const [saving, setSaving] = useState(false);

  const question = ONBOARDING_QUESTIONS[index];
  const isLast = index === ONBOARDING_QUESTIONS.length - 1;
  const total = ONBOARDING_QUESTIONS.length;

  const assessment = useMemo(
    () => ({
      id: "assessment.onboarding",
      userId: "local",
      kind: "onboarding" as const,
      answers: Object.entries(answers).map(
        ([questionId, value]): AssessmentAnswer => ({ questionId, value }),
      ),
      createdAt: new Date().toISOString(),
    }),
    [answers],
  );

  const preview = useMemo(
    () => buildInitialProfile("local", assessment, new Date().toISOString()),
    [assessment],
  );

  const toggle = (questionId: string, value: string, max: number) => {
    setAnswers((current) => {
      const selected = current[questionId] ?? [];
      if (selected.includes(value)) return { ...current, [questionId]: selected.filter((item) => item !== value) };
      if (max === 1) return { ...current, [questionId]: [value] };
      if (selected.length >= max) return current;
      return { ...current, [questionId]: [...selected, value] };
    });
  };

  const finish = async () => {
    setSaving(true);
    await store.completeOnboarding(
      { ...assessment, answers: [...assessment.answers, { questionId: "goal-statement", value: statement }] },
      statement,
    );
    router.replace("/");
  };

  if (!question) return null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {index + 1} of {total}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {ONBOARDING_QUESTIONS.map((item, position) => (
            <span
              key={item.id}
              className="h-1 w-6 rounded-full"
              style={{ background: position <= index ? "var(--accent)" : "var(--border)" }}
            />
          ))}
        </div>
      </div>

      {index === 0 ? (
        <Card className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Rapport</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            A training system for practical communication skills. Seven quick questions, then a five-minute
            session a day. Everything you enter stays on this device by default.
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            No score, no ranking, and no judgement about what kind of person you are — only what you practise
            and what gets easier.
          </p>
        </Card>
      ) : null}

      <Card as="section" className="rise">
        <h2 className="text-lg font-semibold tracking-tight">{question.prompt}</h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>{question.purpose}</p>

        {question.kind === "text" ? (
          <div className="mt-4">
            <Field id="statement" label="In your own words" hint="Optional. Kept exactly as you write it.">
              <TextArea
                id="statement"
                rows={3}
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                placeholder="e.g. I'd like to be able to speak up in team meetings without rehearsing it for an hour first."
              />
            </Field>
          </div>
        ) : (
          <>
            {question.maxSelections && question.maxSelections > 1 ? (
              <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
                Choose up to {question.maxSelections}.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {question.options?.map((option) => {
                const selected = (answers[question.id] ?? []).includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggle(question.id, option.value, question.maxSelections ?? 1)}
                    aria-pressed={selected}
                    className="rounded-[10px] border px-3.5 py-2 text-left text-sm transition-colors"
                    style={{
                      background: selected ? "var(--accent-soft)" : "var(--surface)",
                      borderColor: selected ? "var(--accent)" : "var(--border-strong)",
                      color: selected ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {isLast ? (
        <Card className="mt-4">
          <Badge tone="accent">Your starting point</Badge>
          <p className="mt-3 text-sm leading-relaxed">{describeProfile(preview)}</p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
            You can correct any of these at any time from the Skills page.
          </p>
        </Card>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </Button>
        <div className="flex gap-2">
          {question.optional || (answers[question.id]?.length ?? 0) === 0 ? (
            <Button variant="ghost" onClick={() => (isLast ? void finish() : setIndex((value) => value + 1))}>
              Skip
            </Button>
          ) : null}
          <Button
            onClick={() => (isLast ? void finish() : setIndex((value) => value + 1))}
            disabled={saving}
          >
            {isLast ? (saving ? "Setting up…" : "Start training") : "Next"}
            {!isLast ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
