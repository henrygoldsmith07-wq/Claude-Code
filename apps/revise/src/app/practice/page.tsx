"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { aiGenerateQuestions } from "@/ai/client";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { remediationForMistake } from "@/domain/remediation";
import { rankQuestionsForExposure } from "@/domain/question-exposure";
import type { Mistake, Question } from "@/domain/types";
import { useStore, useSubjects } from "@/state/store";
import { QuestionRunner } from "@/components/QuestionRunner";
import { RichText } from "@/components/RichText";
import { Button, ButtonLink, EmptyState, Panel, Pill, SectionHeading, Segmented } from "@/components/ui";

// Question practice. The queue is built from everything the student has: the
// authored bank, questions extracted from their own uploaded papers, and
// anything generated for them. Weakest topics surface first.

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <Practice />
    </Suspense>
  );
}

function Practice() {
  const params = useSearchParams();
  const store = useStore();
  const { saveRevisionCheckpoint, clearRevisionCheckpoint } = store;
  const subjects = useSubjects();
  const topicParam = params.get("topic");
  const subjectParam = params.get("subject");
  const sessionId = params.get("session");
  const questionParam = params.get("question");
  const retestId = params.get("retest");
  const mode = params.get("mode") === "recall" ? "recall" : "practice";
  const resumeRequested = params.get("resume") === "1";
  const savedCheckpoint =
    resumeRequested && store.revisionCheckpoint?.activity === "practice" ? store.revisionCheckpoint : null;

  const [subjectId, setSubjectId] = useState(subjectParam ?? subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState(topicParam ?? "");
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const [submittedIndex, setSubmittedIndex] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const masteryByTopic = useMemo(() => new Map(store.mastery.map((m) => [m.topicId, m])), [store.mastery]);
  const questionsById = useMemo(
    () => new Map(store.questions.map((q) => [q.id, q] as const)),
    [store.questions],
  );
  const retestMistake: Mistake | undefined = useMemo(
    () => (retestId ? store.mistakes.find((mistake) => mistake.id === retestId) : undefined),
    [retestId, store.mistakes],
  );
  const retestQuestion = retestMistake?.questionId ? questionsById.get(retestMistake.questionId) : undefined;
  const originalAttempt = retestMistake?.attemptId
    ? store.attempts.find((attempt) => attempt.id === retestMistake.attemptId)
    : undefined;
  const retestRemediation = useMemo(
    () =>
      retestMistake && retestQuestion
        ? remediationForMistake(
            retestMistake,
            retestQuestion,
            originalAttempt,
            getTopic(retestMistake.topicId),
          )
        : null,
    [originalAttempt, retestMistake, retestQuestion],
  );

  /**
   * Order the pool once, then hold it. Marking an answer changes mastery and
   * marks the question as seen, so a live re-sort would swap the question out
   * from under the student the instant they submitted it — taking the marking
   * with it. The order is recomputed only when the student changes the filters
   * or generates new questions.
   */
  const orderFor = (subject: string, topic: string): string[] => {
    if (retestQuestion) return [retestQuestion.id];
    let pool = store.questions.filter((q) => store.settings.subjectIds.includes(q.subjectId));
    if (questionParam) pool = pool.filter((q) => q.id === questionParam);
    else {
      if (subject) pool = pool.filter((q) => q.subjectId === subject);
      if (topic) pool = pool.filter((q) => q.topicIds.includes(topic));
    }
    // Exposure control keeps unseen questions ahead of secure repeats, while
    // still allowing weak questions back into the queue when they need work.
    return rankQuestionsForExposure({
      questions: pool,
      attempts: store.attempts,
      masteryByTopic: new Map([...masteryByTopic.entries()].map(([id, row]) => [id, row.mastery])),
    })
      .map((q) => q.id);
  };

  const [index, setIndex] = useState(() => savedCheckpoint?.position ?? 0);
  const [order, setOrder] = useState<string[]>(() => savedCheckpoint?.queueIds?.length ? savedCheckpoint.queueIds : orderFor(subjectId, topicId));

  const queue = useMemo(
    () => order.map((id) => questionsById.get(id)).filter((q): q is Question => Boolean(q)),
    [order, questionsById],
  );

  const current: Question | undefined = retestMistake ? retestQuestion : queue[index];

  const checkpointHref = useMemo(() => {
    const next = new URLSearchParams();
    if (subjectId) next.set("subject", subjectId);
    if (topicId) next.set("topic", topicId);
    if (mode === "recall") next.set("mode", mode);
    if (sessionId) next.set("session", sessionId);
    if (retestId) next.set("retest", retestId);
    next.set("resume", "1");
    const query = next.toString();
    return query ? `/practice?${query}` : "/practice?resume=1";
  }, [mode, retestId, sessionId, subjectId, topicId]);

  useEffect(() => {
    if (finished || !current) {
      if (resumeRequested && !current) void clearRevisionCheckpoint();
      return;
    }
    if (retestMistake?.resolved) {
      void clearRevisionCheckpoint();
      return;
    }
    void saveRevisionCheckpoint({
      activity: "practice",
      title: retestMistake ? "Retest a mistake" : mode === "recall" ? "Active recall" : "Exam questions",
      href: checkpointHref,
      position: retestMistake ? 0 : index,
      total: retestMistake ? 1 : queue.length,
      queueIds: retestMistake ? [current.id] : order,
      retestMistakeId: retestMistake?.id,
    });
  }, [checkpointHref, clearRevisionCheckpoint, current, finished, index, mode, order, queue.length, resumeRequested, retestMistake, saveRevisionCheckpoint]);

  async function generate() {
    if (!topicId) {
      setNote("Choose a topic first — generated questions are grounded in one topic's spec content.");
      return;
    }
    setGenerating(true);
    setNote(null);
    const result = await aiGenerateQuestions(topicId, 2);
    const topic = getTopic(topicId);
    const created: Question[] = result.data.questions.map((generated) => ({
      id: crypto.randomUUID(),
      subjectId: topic?.subjectId ?? subjectId,
      topicIds: [topicId],
      kind: generated.kind,
      stem: generated.stem,
      options: generated.options,
      correctIndex: generated.correctIndex,
      parts: generated.parts.map((part, i) => ({
        id: crypto.randomUUID(),
        label: part.label || (generated.parts.length > 1 ? `(${"abcdefgh"[i]})` : ""),
        prompt: part.prompt,
        marks: part.marks,
        markScheme: part.markScheme,
        modelAnswer: part.modelAnswer,
      })),
      totalMarks: generated.parts.reduce((a, p) => a + p.marks, 0),
      calculatorAllowed: true,
      difficulty: generated.difficulty as 1 | 2 | 3 | 4 | 5,
      origin: result.source === "ai" ? "ai" : "seed",
      createdAt: new Date().toISOString(),
    }));

    // The fallback returns bank questions that are already stored — adding
    // them again would duplicate the whole topic's bank.
    const fresh = created.filter((q) => !store.questions.some((existing) => existing.stem === q.stem));
    if (fresh.length) {
      await store.addQuestions(fresh);
      // New questions go to the front: the student asked for them just now.
      setOrder((prev) => [...fresh.map((q) => q.id), ...prev]);
      setIndex(0);
      setSubmittedIndex(null);
    }
    setNote(
      result.source === "ai"
        ? `Generated ${fresh.length} new question${fresh.length === 1 ? "" : "s"} on this topic.`
        : "No AI provider available, so this is showing questions from the authored bank instead.",
    );
    setGenerating(false);
  }

  const topics = subjectId ? topicsFor(subjectId) : [];

  if (finished) {
    return (
      <EmptyState
        title="Practice session complete"
        body="That queue is done. Your marks and any new mistake cards are already saved."
        action={
          <div className="flex gap-2">
            <ButtonLink href="/" variant="primary">Back to Today</ButtonLink>
            <ButtonLink href="/practice">Practise another set</ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {retestMistake ? "Retest a mistake" : mode === "recall" ? "Active recall" : "Exam questions"}
          </h1>
          <p className="text-sm text-ink3 mt-0.5">
            {retestMistake
              ? "Apply the remediation, answer the original question again, and close the loop only when the missed point is secure."
              : mode === "recall"
              ? "Answer from memory with nothing in front of you, then get it marked."
              : "Answer as you would in the exam. Every dropped mark becomes a card."}
          </p>
        </div>
        {subjects.length > 1 ? (
          <Segmented
            ariaLabel="Subject"
            value={subjectId}
            onChange={(value) => {
               setSubjectId(value);
               setTopicId("");
               setIndex(0);
               setSubmittedIndex(null);
               setOrder(orderFor(value, ""));
            }}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={topicId}
          disabled={Boolean(retestMistake)}
          onChange={(e) => {
            setTopicId(e.target.value);
            // The queue is rebuilt for the new filter, so a stale cursor would
             // land on an unrelated question.
             setIndex(0);
             setSubmittedIndex(null);
             setOrder(orderFor(subjectId, e.target.value));
          }}
          className="field field-inline text-sm"
          aria-label="Topic"
        >
          <option value="">All topics</option>
          {topics.map((topic) => {
            const mastery = masteryByTopic.get(topic.id);
            return (
              <option key={topic.id} value={topic.id}>
                {topic.title}
                {mastery ? ` — ${Math.round(mastery.mastery * 100)}%` : ""}
              </option>
            );
          })}
        </select>
        <Button size="sm" onClick={() => void generate()} disabled={generating || Boolean(retestMistake)}>
          {generating ? "Generating…" : "Generate similar questions"}
        </Button>
        {queue.length ? (
          <span className="text-xs text-ink3 ml-auto tabular-nums">
            {index + 1} of {queue.length}
          </span>
        ) : null}
      </div>

      {note ? <p className="text-xs text-ink3">{note}</p> : null}

      {retestMistake && current ? (
        <Panel className="card-2 border-l-4 border-l-accent">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={retestMistake.resolved ? "success" : "danger"}>
              {retestMistake.resolved ? "Resolved mistake" : "Open mistake"}
            </Pill>
            <span className="text-xs text-ink3">{retestMistake.description}</span>
          </div>
          {retestRemediation ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Remediation</p>
              <p className="text-sm text-ink">{retestRemediation.action}</p>
              <p className="text-xs text-ink3">Evidence: {retestRemediation.evidence}</p>
              {retestRemediation.targetKeyPoint ? (
                <p className="text-xs text-ink3">Restudy: {retestRemediation.targetKeyPoint}</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-[11px] text-ink3 mt-3">
            Targeted retests: {retestMistake.retestCount ?? 0} · submit when you are ready to check the point again.
          </p>
        </Panel>
      ) : retestId ? (
        <Panel>
          <p className="text-sm text-ink2">That mistake or its source question is no longer available.</p>
          <ButtonLink href="/progress" variant="primary" className="inline-block mt-3">
            Return to Progress
          </ButtonLink>
        </Panel>
      ) : null}

      {mode === "recall" && current ? (
        <Panel className="card-2">
          <p className="text-xs text-ink2">
            <span className="font-semibold">Blank page first.</span> Write everything you can recall about{" "}
            {getTopic(current.topicIds[0] ?? "")?.title ?? "this topic"} before you read the question — then answer
            it. Retrieval before review is what makes this work.
          </p>
        </Panel>
      ) : null}

      {retestId && (!retestMistake || !retestQuestion) ? null : current ? (
        <>
          <QuestionRunner
            key={`${current.id}:${retestMistake?.id ?? "practice"}`}
            question={current}
            mode={mode}
            retestMistake={retestMistake}
            onFinished={() => {
              setCompleted((c) => c + 1);
              setSubmittedIndex(index);
              if (sessionId && completed === 0) void store.completeSession(sessionId);
            }}
          />
          {retestMistake ? (
            <ButtonLink href="/progress" variant="primary" className="inline-block">
              Back to Progress
            </ButtonLink>
          ) : (
            <div className="flex justify-between gap-2">
              <Button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                Previous
              </Button>
              {index >= queue.length - 1 ? (
                <Button
                  variant="primary"
                  disabled={submittedIndex !== index}
                  onClick={() => {
                    void clearRevisionCheckpoint();
                    setFinished(true);
                  }}
                >
                  Finish session
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setIndex((i) => i + 1)}>
                  Next question
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="No questions here yet"
          body={
            topicId
              ? "Nothing is stored for this topic. Generate exam-style questions from the spec content, or upload a past paper to extract real ones."
              : "Pick a topic, or upload a past paper to extract questions from it."
          }
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void generate()} disabled={generating}>
                Generate questions
              </Button>
              <ButtonLink href="/papers">Upload a paper</ButtonLink>
            </div>
          }
        />
      )}

      {current ? (
        <section>
          <SectionHeading title="Topic reminders" hint="Read these after you have answered, not before." />
          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Pill>{getSubject(current.subjectId)?.name}</Pill>
              <Pill>{getTopic(current.topicIds[0] ?? "")?.title}</Pill>
            </div>
            <RichText>
              {(getTopic(current.topicIds[0] ?? "")?.keyPoints ?? []).map((p) => `- ${p}`).join("\n")}
            </RichText>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
