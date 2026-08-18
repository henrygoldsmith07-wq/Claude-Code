"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiMark } from "@/ai/client";
import { misconceptionsForTopic } from "@/content";
import { validateCommandWord, type CommandWordValidation } from "@/domain/command-word-validation";
import { getTopic } from "@/domain/curriculum";
import {
  completeDelayedFarTransfer,
  scheduleDelayedFarTransfer,
  type DelayedFarTransferRetest,
} from "@/domain/delayed-far-transfer";
import { markMcq } from "@/domain/marking";
import { assessLowConfidenceMark, createMarkEscalationRecord } from "@/domain/mark-escalation";
import type { LowConfidenceMarkDecision } from "@/domain/mark-escalation";
import { planRemediation, type RemediationAction } from "@/domain/remediation";
import type { Attempt, MarkedPart, Question } from "@/domain/types";
import { useStore } from "@/state/store";
import { AnswerInput } from "./AnswerInput";
import { RichText } from "./RichText";
import { Button, Panel, Pill, ProgressBar, SourceBadge, cx } from "./ui";
import { CreditedIcon, ICON_SIZE, MissedIcon } from "./icons";

// The practice loop: attempt → marked instantly → see exactly which mark-scheme
// points were earned → dropped marks become mistakes and mistake cards without
// the student having to do anything. That last step is the whole point; a
// mistake you have to file manually is a mistake you never revisit.

export interface QuestionDraft {
  answers: Record<string, string>;
  choice: number | null;
}

export function QuestionRunner({
  question,
  mode = "practice",
  farTransfer,
  draft,
  onDraftChange,
  onFinished,
}: {
  question: Question;
  mode?: Attempt["mode"];
  farTransfer?: DelayedFarTransferRetest;
  draft?: QuestionDraft;
  onDraftChange?: (draft: QuestionDraft) => void;
  onFinished?: (attempt: Attempt) => void;
}) {
  const store = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(draft?.answers ?? {}) }));
  const [choice, setChoice] = useState<number | null>(() => draft?.choice ?? null);
  const [marking, setMarking] = useState(false);
  const [result, setResult] = useState<{
    marked: MarkedPart[];
    feedback: string;
    source: "ai" | "fallback";
    note?: string;
    confidence: number | null;
    escalation?: LowConfidenceMarkDecision;
    farTransfer?: Attempt["farTransfer"];
  } | null>(null);
  // Stamped after mount: reading the clock during render makes the render
  // impure and would restart the timer on every re-render.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const isMcq = question.kind === "mcq";
  const topic = getTopic(question.topicIds[0] ?? "");

  const awarded = useMemo(() => result?.marked.reduce((a, m) => a + m.awarded, 0) ?? 0, [result]);

  async function submit() {
    setMarking(true);
    const elapsedMs = startedAt.current ? Date.now() - startedAt.current : 0;

    // MCQs are marked locally and instantly — sending a letter to a model for
    // grading would be slower, costlier and no more accurate.
    let marked: MarkedPart[];
    let feedback: string;
    let source: "ai" | "fallback" = "fallback";
    let note: string | undefined;
    let markConfidence: number | null = null;

    if (isMcq) {
      const single = markMcq(question, choice ?? -1);
      marked = [single];
      feedback =
        single.awarded > 0
          ? `Correct. ${question.parts[0]?.modelAnswer ?? ""}`
          : `${single.comment} ${question.parts[0]?.modelAnswer ?? ""}`;
    } else {
      const envelope = await aiMark(question, answers);
      marked = envelope.data.marked;
      feedback = envelope.data.feedback;
      source = envelope.source;
      note = envelope.note;
      markConfidence = source === "ai" && typeof envelope.data.confidence === "number" ? envelope.data.confidence : null;
    }

    const markedBy: Attempt["markedBy"] = source === "ai" ? "ai" : "rubric";
    const attemptId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const escalationDecision = assessLowConfidenceMark({
      markedBy,
      confidence: source === "ai" ? markConfidence : undefined,
    });
    const markEscalation = createMarkEscalationRecord(escalationDecision, createdAt);
    const attempt: Attempt = {
      id: attemptId,
      userId: store.userId,
      questionId: question.id,
      subjectId: question.subjectId,
      topicIds: question.topicIds,
      answers: isMcq ? { [question.parts[0]?.id ?? question.id]: String(choice) } : answers,
      marked,
      awarded: marked.reduce((a, m) => a + m.awarded, 0),
      max: marked.reduce((a, m) => a + m.max, 0),
      feedback,
      markedBy,
      markConfidence: source === "ai" ? markConfidence ?? undefined : undefined,
      markEscalation,
      elapsedMs,
      mode,
      createdAt,
    };

    const farTransferLink = farTransfer
      ? completeDelayedFarTransfer(farTransfer, attempt)
      : scheduleDelayedFarTransfer({
          attempt,
          question,
          questions: store.questions,
          attemptedQuestionIds: store.attempts.map((existing) => existing.questionId),
        });
    const persistedAttempt = farTransferLink ? { ...attempt, farTransfer: farTransferLink } : attempt;

    await store.recordAttempt(persistedAttempt, question);
    setResult({
      marked,
      feedback,
      source,
      note,
      confidence: markConfidence,
      escalation: escalationDecision.escalate ? escalationDecision : undefined,
      farTransfer: persistedAttempt.farTransfer,
    });
    setMarking(false);
    onFinished?.(persistedAttempt);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill>{question.totalMarks} marks</Pill>
          <Pill>{topic?.title ?? question.subjectId}</Pill>
          {question.origin === "past-paper" ? <Pill tone="review">Past paper</Pill> : null}
          {question.origin === "ai" ? <Pill tone="speak">AI generated</Pill> : null}
          {!question.calculatorAllowed ? <Pill tone="danger">No calculator</Pill> : null}
          {farTransfer ? <Pill tone="accent">Delayed far-transfer</Pill> : null}
        </div>

        {farTransfer ? (
          <div className="rounded-[8px] border border-accent bg-accentsoft px-3 py-2.5 mb-4 text-sm text-ink2">
            <p className="font-semibold text-ink">A different-context transfer check</p>
            <p className="text-xs mt-1">
              This question tests the same mapped learning claim after a {farTransfer.delayDays}-day delay. It is
              scored separately from the original answer.
            </p>
          </div>
        ) : null}

        <RichText className="text-base leading-7 text-ink">{question.stem}</RichText>

        {isMcq ? (
          <ul className="mt-4 space-y-1.5">
            {question.options?.map((option, index) => {
              const correct = result && index === question.correctIndex;
              const wrongPick = result && index === choice && index !== question.correctIndex;
              return (
                <li key={index}>
                  <button
                    type="button"
                    disabled={Boolean(result)}
                    onClick={() => {
                      setChoice(index);
                      onDraftChange?.({ answers, choice: index });
                    }}
                    className={cx(
                      "w-full min-h-12 sm:min-h-0 text-left card px-3 py-3 sm:py-2.5 flex gap-2.5 items-start transition-colors",
                      choice === index && !result && "border-ink3 bg-surface2",
                      correct && "border-success bg-successsoft",
                      wrongPick && "border-danger bg-dangersoft",
                    )}
                  >
                    <span className="text-xs font-semibold text-ink3 mt-0.5">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <RichText className="text-sm flex-1">{option}</RichText>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 space-y-5">
            {question.parts.map((part) => (
              <div key={part.id}>
                <div className="flex items-start gap-2 mb-1.5">
                  {part.label ? <span className="text-sm font-semibold text-ink">{part.label}</span> : null}
                  <RichText className="text-sm leading-6 flex-1 min-w-0">{part.prompt}</RichText>
                  <span className="text-xs text-ink3 shrink-0 pt-0.5">[{part.marks}]</span>
                </div>
                <CommandWordCheck validation={validateCommandWord(question, part, answers[part.id] ?? "")} />
                {result ? (
                  <div className="card card-2 p-3 text-sm text-ink2 whitespace-pre-wrap break-words">
                    {answers[part.id]?.trim() || "(no answer given)"}
                  </div>
                ) : (
                  <AnswerInput
                    id={part.id}
                    value={answers[part.id] ?? ""}
                    onChange={(value) => {
                      const nextAnswers = { ...answers, [part.id]: value };
                      setAnswers(nextAnswers);
                      onDraftChange?.({ answers: nextAnswers, choice });
                    }}
                    rows={Math.min(10, Math.max(3, part.marks + 1))}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!result ? (
          <Button
            variant="primary"
            className="w-full min-h-11 mt-5"
            disabled={marking || (isMcq ? choice === null : !Object.values(answers).some((a) => a.trim()))}
            onClick={() => void submit()}
          >
            {marking ? "Marking…" : "Submit for marking"}
          </Button>
        ) : null}
      </Panel>

      {result ? <MarkedResult question={question} result={result} awarded={awarded} answers={answers} /> : null}
    </div>
  );
}

function CommandWordCheck({ validation }: { validation: CommandWordValidation }) {
  if (validation.status === "not-applicable") return null;
  const tone = validation.status === "aligned" ? "success" : validation.status === "needs-attention" ? "review" : "neutral";
  const status = validation.status === "aligned" ? "Verb covered" : validation.status === "empty" ? "Start with the verb" : "Check the verb";
  return (
    <div className="flex items-start gap-2 mt-2 text-[11px] text-ink3">
      <Pill tone={tone}>{validation.label}</Pill>
      <p className="pt-0.5 leading-relaxed">
        <span className="font-semibold text-ink2">{status}.</span> {validation.message}
      </p>
    </div>
  );
}

function MarkedResult({
  question,
  result,
  awarded,
  answers,
}: {
  question: Question;
  result: {
    marked: MarkedPart[];
    feedback: string;
    source: "ai" | "fallback";
    note?: string;
    confidence: number | null;
    escalation?: LowConfidenceMarkDecision;
    farTransfer?: Attempt["farTransfer"];
  };
  awarded: number;
  answers: Record<string, string>;
}) {
  const pct = question.totalMarks ? awarded / question.totalMarks : 0;
  const topic = getTopic(question.topicIds[0] ?? "");
  const misconceptions = useMemo(
    () => [...new Set(question.topicIds.flatMap((id) => misconceptionsForTopic(id)))],
    [question.topicIds],
  );
  const plan = useMemo(
    () => planRemediation(question, answers, result.marked, topic, misconceptions),
    [question, answers, result.marked, topic, misconceptions],
  );
  const actions = useMemo(() => {
    const seen = new Map<string, RemediationAction>();
    for (const part of plan.parts) {
      for (const action of part.actions) {
        const key = action.misconception.toLowerCase();
        const prev = seen.get(key);
        if (!prev || action.confidence > prev.confidence) seen.set(key, action);
      }
    }
    return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
  }, [plan]);
  return (
    <Panel className="fade-in">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Examiner marking</p>
          <p className="text-2xl font-semibold tabular-nums">
            {awarded}
            <span className="text-ink3 text-lg">/{question.totalMarks}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <SourceBadge source={result.source} note={result.note} />
          {result.farTransfer ? (
            <Pill
              tone={
                result.farTransfer.role === "retest"
                  ? result.farTransfer.outcome?.passed
                    ? "success"
                    : "danger"
                  : "accent"
              }
            >
              {result.farTransfer.role === "retest"
                ? `Transfer ${Math.round((result.farTransfer.outcome?.percentage ?? 0) * 100)}%`
                : `Transfer check due ${result.farTransfer.scheduledFor}`}
            </Pill>
          ) : null}
          {result.source === "ai" ? (
            <Pill tone={result.escalation ? "review" : "success"}>
              {result.confidence === null ? "AI confidence unavailable" : `AI confidence ${Math.round(result.confidence * 100)}%`}
            </Pill>
          ) : null}
        </div>
      </div>
      {result.escalation ? (
        <div className="rounded-[8px] border border-review bg-reviewsoft px-3 py-2.5 text-sm text-ink2" role="status">
          <p className="font-semibold text-review">Human review requested</p>
          <p className="text-xs mt-1">{result.escalation.message}</p>
          <p className="text-[11px] text-ink3 mt-1">This pending escalation is saved with the attempt for a second-marker decision.</p>
        </div>
      ) : null}
      {result.farTransfer?.role === "source" ? (
        <p className="text-xs text-ink3 mb-3">
          You have another question scheduled for {result.farTransfer.scheduledFor} to check whether this learning
          transfers to a new context.
        </p>
      ) : null}
      <ProgressBar value={pct} tone={pct >= 0.8 ? "success" : pct >= 0.5 ? "review" : "danger"} />

      <div className="mt-4 space-y-4">
        {result.marked.map((marked) => {
          const part = question.parts.find((p) => p.id === marked.partId);
          return (
            <div key={marked.partId}>
              <p className="text-sm font-semibold text-ink">
                {part?.label || "Answer"} — {marked.awarded}/{marked.max}
              </p>
              {marked.creditedPoints.length ? (
                <ul className="mt-1.5 space-y-1">
                  {marked.creditedPoints.map((point, i) => (
                    <li key={i} className="text-xs text-success flex gap-1.5">
                      <CreditedIcon size={ICON_SIZE.sm} aria-hidden className="shrink-0 mt-px" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {marked.missedPoints.length ? (
                <ul className="mt-1.5 space-y-1">
                  {marked.missedPoints.map((point, i) => (
                    <li key={i} className="text-xs text-danger flex gap-1.5">
                      <MissedIcon size={ICON_SIZE.sm} aria-hidden className="shrink-0 mt-px" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {marked.comment ? <p className="text-xs text-ink3 mt-1.5">{marked.comment}</p> : null}
              {part?.modelAnswer ? (
                <details className="mt-2">
                  <summary className="text-xs text-ink2 cursor-pointer select-none">Model answer</summary>
                  <RichText className="mt-1.5 text-sm">{part.modelAnswer}</RichText>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>

      {question.kind !== "mcq" && actions.length ? (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-2">How to fix it</p>
          <ul className="space-y-2.5">
            {actions.map((action) => (
              <li key={action.misconception} className="card card-2 p-3">
                <div className="flex items-start gap-2">
                  <MissedIcon size={ICON_SIZE.sm} aria-hidden className="shrink-0 mt-0.5 text-danger" />
                  <p className="text-sm font-semibold text-ink">{action.misconception}</p>
                </div>
                {action.misconceptionEntry ? (
                  <>
                    <p className="text-xs text-ink3 mt-2">
                      <span className="font-semibold">What it looks like: </span>
                      {action.misconceptionEntry.example}
                    </p>
                    <p className="text-sm text-ink2 mt-1.5">{action.misconceptionEntry.explanation}</p>
                    <div className="flex items-start gap-2 mt-1.5">
                      <CreditedIcon size={ICON_SIZE.sm} aria-hidden className="shrink-0 mt-0.5 text-success" />
                      <p className="text-sm text-ink2 flex-1">{action.misconceptionEntry.correction}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink2 mt-1.5">{action.action}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 pt-4 border-t border-line space-y-3">
        <RichText className="text-sm">{result.feedback}</RichText>
        {/* Ask: what did this one attempt teach us? */}
        {result.marked.some((m) => m.missedPoints.length) ? (
          <div className="flex flex-wrap gap-1.5">
            {result.marked.flatMap((m) => m.missedPoints).slice(0, 3).map((point, i) => {
              const part = question.parts.find((p) => result.marked.some((mm) => mm.partId === p.id && mm.missedPoints.includes(point)));
              const ao = part?.aos?.[0];
              const difficulty = question.difficulty;
              return (
                <span key={i} className="inline-flex gap-1">
                  {ao ? <Pill tone="danger">{ao}</Pill> : null}
                  <Pill>Lvl {difficulty}</Pill>
                </span>
              );
            })}
          </div>
        ) : null}
        {awarded < question.totalMarks ? (
          <p className="text-[11px] text-ink3">
            The dropped marks have been logged as mistakes — with AO, command word and timing — and turned into cards that will reappear until you can answer them. See <span className="font-semibold">Progress</span> for expected marks per hour.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
