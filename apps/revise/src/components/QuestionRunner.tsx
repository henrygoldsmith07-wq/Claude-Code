"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiMark } from "@/ai/client";
import { getTopic } from "@/domain/curriculum";
import { markMcq } from "@/domain/marking";
import { evaluateMistakeRetest } from "@/domain/mistakes";
import { planRemediation } from "@/domain/remediation";
import type { Attempt, MarkedPart, Mistake, Question } from "@/domain/types";
import type { RetestEvaluation } from "@/domain/mistakes";
import type { RemediationPlan } from "@/domain/remediation";
import { useStore } from "@/state/store";
import { AnswerInput } from "./AnswerInput";
import { RichText } from "./RichText";
import { Button, Panel, Pill, ProgressBar, SourceBadge, cx } from "./ui";
import { CreditedIcon, ICON_SIZE, MissedIcon } from "./icons";

// The practice loop: attempt → marked instantly → see exactly which mark-scheme
// points were earned → dropped marks become mistakes and mistake cards without
// the student having to do anything. That last step is the whole point; a
// mistake you have to file manually is a mistake you never revisit.

export function QuestionRunner({
  question,
  mode = "practice",
  retestMistake,
  onFinished,
}: {
  question: Question;
  mode?: Attempt["mode"];
  retestMistake?: Mistake;
  onFinished?: (attempt: Attempt) => void;
}) {
  const store = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);
  const [result, setResult] = useState<{
    marked: MarkedPart[];
    feedback: string;
    source: "ai" | "fallback";
    note?: string;
    retest?: RetestEvaluation;
    remediation: RemediationPlan;
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
    }

    const submittedAnswers = isMcq ? { [question.parts[0]?.id ?? question.id]: String(choice) } : answers;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      userId: store.userId,
      questionId: question.id,
      subjectId: question.subjectId,
      topicIds: question.topicIds,
      answers: submittedAnswers,
      marked,
      awarded: marked.reduce((a, m) => a + m.awarded, 0),
      max: marked.reduce((a, m) => a + m.max, 0),
      feedback,
      markedBy: source === "ai" ? "ai" : "rubric",
      elapsedMs,
      mode,
      ...(retestMistake ? { retestMistakeId: retestMistake.id } : {}),
      createdAt: new Date().toISOString(),
    };

    const retest = retestMistake ? evaluateMistakeRetest(retestMistake, question, attempt) : undefined;
    const remediation = planRemediation(question, submittedAnswers, marked, topic);
    await store.recordAttempt(attempt, question);
    setResult({ marked, feedback, source, note, retest, remediation });
    setMarking(false);
    onFinished?.(attempt);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill>{question.totalMarks} marks</Pill>
          <Pill>{topic?.title ?? question.subjectId}</Pill>
          {retestMistake ? <Pill tone="review">Retest</Pill> : null}
          {question.origin === "past-paper" ? <Pill tone="review">Past paper</Pill> : null}
          {question.origin === "ai" ? <Pill tone="speak">AI generated</Pill> : null}
          {!question.calculatorAllowed ? <Pill tone="danger">No calculator</Pill> : null}
        </div>

        <RichText className="text-base text-ink">{question.stem}</RichText>

        {isMcq ? (
          <ul className="mt-4 space-y-1.5">
            {question.options?.map((option, index) => {
              const correct = result && index === question.correctIndex;
              const wrongPick = result && index === choice && index !== question.correctIndex;
              return (
                <li key={index}>
                  <button
                    disabled={Boolean(result)}
                    onClick={() => setChoice(index)}
                    className={cx(
                      "w-full text-left card px-3 py-2.5 flex gap-2.5 items-start transition-colors",
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
                <div className="flex items-baseline gap-2 mb-1.5">
                  {part.label ? <span className="text-sm font-semibold text-ink">{part.label}</span> : null}
                  <RichText className="text-sm flex-1">{part.prompt}</RichText>
                  <span className="text-xs text-ink3 shrink-0">[{part.marks}]</span>
                </div>
                {result ? (
                  <div className="card card-2 p-3 text-sm text-ink2 whitespace-pre-wrap">
                    {answers[part.id]?.trim() || "(no answer given)"}
                  </div>
                ) : (
                  <AnswerInput
                    id={part.id}
                    value={answers[part.id] ?? ""}
                    onChange={(value) => setAnswers((prev) => ({ ...prev, [part.id]: value }))}
                    rows={Math.min(10, Math.max(3, part.marks + 1))}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!result && retestMistake?.resolved ? (
          <p className="text-xs text-success mt-5">This mistake is already resolved. Return to Progress to choose another repair.</p>
        ) : null}
        {!result && !retestMistake?.resolved ? (
          <Button
            variant="primary"
            className="w-full mt-5"
            disabled={marking || (isMcq ? choice === null : !Object.values(answers).some((a) => a.trim()))}
            onClick={() => void submit()}
          >
            {marking ? "Marking…" : "Submit for marking"}
          </Button>
        ) : null}
      </Panel>

      {result ? <MarkedResult question={question} result={result} awarded={awarded} /> : null}
    </div>
  );
}

function MarkedResult({
  question,
  result,
  awarded,
}: {
  question: Question;
  result: {
    marked: MarkedPart[];
    feedback: string;
    source: "ai" | "fallback";
    note?: string;
    retest?: RetestEvaluation;
    remediation: RemediationPlan;
  };
  awarded: number;
}) {
  const pct = question.totalMarks ? awarded / question.totalMarks : 0;
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
        <SourceBadge source={result.source} note={result.note} />
      </div>
      <ProgressBar value={pct} tone={pct >= 0.8 ? "success" : pct >= 0.5 ? "review" : "danger"} />

      {result.retest ? (
        <div
          className={cx(
            "mt-4 card card-2 p-3",
            result.retest.status === "resolved"
              ? "border-success bg-successsoft"
              : result.retest.status === "still-open"
                ? "border-danger bg-dangersoft"
                : "bg-surface2",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              tone={
                result.retest.status === "resolved"
                  ? "success"
                  : result.retest.status === "still-open"
                    ? "danger"
                    : "review"
              }
            >
              {result.retest.status === "resolved"
                ? "Retest passed"
                : result.retest.status === "still-open"
                  ? "Retest still open"
                  : "Retest not linked"}
            </Pill>
            <span className="text-xs text-ink2">{result.retest.feedback}</span>
          </div>
          {result.retest.status === "resolved" ? (
            <p className="text-[11px] text-success mt-2">The mistake has been removed from your open repair queue.</p>
          ) : result.retest.status === "still-open" ? (
            <p className="text-[11px] text-ink2 mt-2">Repeat the remediation above, then retest this question again.</p>
          ) : null}
        </div>
      ) : null}

      {result.remediation.headline ? (
        <div className="mt-4 card card-2 p-3 bg-surface2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="review">Remediation</Pill>
            <span className="text-xs text-ink2">{result.remediation.headline.misconception}</span>
          </div>
          <p className="text-sm text-ink mt-2">{result.remediation.headline.action}</p>
          <p className="text-[11px] text-ink3 mt-1.5">Evidence: {result.remediation.headline.evidence}</p>
          {result.remediation.headline.targetKeyPoint ? (
            <p className="text-[11px] text-ink3 mt-1">
              Restudy: {result.remediation.headline.targetKeyPoint}
            </p>
          ) : null}
        </div>
      ) : null}

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
              {marked.evidence?.length ? (
                <details className="mt-2" open={marked.missedPoints.length > 0}>
                  <summary className="text-xs text-ink2 cursor-pointer select-none">Evidence for each mark</summary>
                  <p className="text-[11px] text-ink3 mt-1.5">Matched locally against your answer and the mark scheme.</p>
                  <ul className="mt-2 space-y-2">
                    {marked.evidence.map((item, i) => {
                      const tone = item.status === "credited" ? "success" : item.status === "missed" ? "danger" : "review";
                      const label = item.status === "credited" ? "awarded" : item.status === "missed" ? "not awarded" : "unreported";
                      return (
                        <li key={`${item.point}:${i}`} className="card card-2 p-2.5 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill tone={tone}>{label}</Pill>
                            <Pill>{item.evidenceStrength} evidence</Pill>
                          </div>
                          <p className="text-ink2 mt-1.5">{item.point}</p>
                          <p className="text-ink3 mt-1">{item.explanation}</p>
                          {item.evidence ? (
                            <p className="text-ink3 mt-1">
                              Submitted text: <span className="text-ink2">“{item.evidence}”</span>
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
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
        {!result.retest && awarded < question.totalMarks ? (
          <p className="text-[11px] text-ink3">
            The dropped marks have been logged as mistakes — with AO, command word and timing — and turned into cards that will reappear until you can answer them. See <span className="font-semibold">Progress</span> for expected marks per hour.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
