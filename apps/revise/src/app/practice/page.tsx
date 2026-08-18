"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { aiGenerateQuestions } from "@/ai/client";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { parseQuickSessionMinutes, type QuickSessionMinutes } from "@/domain/quick-session";
import type { Question } from "@/domain/types";
import { useStore, useSubjects } from "@/state/store";
import { QuickSessionMode, QuickSessionPicker } from "@/components/QuickSessionMode";
import { QuestionRunner } from "@/components/QuestionRunner";
import { RichText } from "@/components/RichText";
import { Button, EmptyState, Panel, Pill, SectionHeading, Segmented } from "@/components/ui";

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
  const subjects = useSubjects();
  const topicParam = params.get("topic");
  const subjectParam = params.get("subject");
  const sessionId = params.get("session");
  const questionParam = params.get("question");
  const mode = params.get("mode") === "recall" ? "recall" : "practice";
  const quickParam = params.get("quick");

  const [subjectId, setSubjectId] = useState(subjectParam ?? subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState(topicParam ?? "");
  const [quickMinutes, setQuickMinutes] = useState<QuickSessionMinutes | null>(() => parseQuickSessionMinutes(quickParam));
  const [index, setIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);

  const masteryByTopic = useMemo(() => new Map(store.mastery.map((m) => [m.topicId, m])), [store.mastery]);

  /**
   * Order the pool once, then hold it. Marking an answer changes mastery and
   * marks the question as seen, so a live re-sort would swap the question out
   * from under the student the instant they submitted it — taking the marking
   * with it. The order is recomputed only when the student changes the filters
   * or generates new questions.
   */
  const orderFor = (subject: string, topic: string): string[] => {
    let pool = store.questions.filter((q) => store.settings.subjectIds.includes(q.subjectId));
    if (questionParam) pool = pool.filter((q) => q.id === questionParam);
    else {
      if (subject) pool = pool.filter((q) => q.subjectId === subject);
      if (topic) pool = pool.filter((q) => q.topicIds.includes(topic));
    }
    // Unseen questions first, then weakest topic. Re-doing a question you have
    // already marked teaches recall of the answer, not of the content.
    const attempted = new Set(store.attempts.map((a) => a.questionId));
    return [...pool]
      .sort((a, b) => {
        const seen = Number(attempted.has(a.id)) - Number(attempted.has(b.id));
        if (seen !== 0) return seen;
        const masteryA = masteryByTopic.get(a.topicIds[0] ?? "")?.mastery ?? 0.5;
        const masteryB = masteryByTopic.get(b.topicIds[0] ?? "")?.mastery ?? 0.5;
        return masteryA - masteryB;
      })
      .map((q) => q.id);
  };

  const [order, setOrder] = useState<string[]>(() => orderFor(subjectId, topicId));

  const questionsById = useMemo(
    () => new Map(store.questions.map((q) => [q.id, q])),
    [store.questions],
  );
  const queue = useMemo(
    () => order.map((id) => questionsById.get(id)).filter((q): q is Question => Boolean(q)),
    [order, questionsById],
  );

  const current: Question | undefined = queue[index];

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
    }
    setNote(
      result.source === "ai"
        ? `Generated ${fresh.length} new question${fresh.length === 1 ? "" : "s"} on this topic.`
        : "No AI provider available, so this is showing questions from the authored bank instead.",
    );
    setGenerating(false);
  }

  const topics = subjectId ? topicsFor(subjectId) : [];

  if (quickMinutes) {
    return (
      <QuickSessionMode
        minutes={quickMinutes}
        subjectId={subjectId}
        topicId={topicId}
        onExit={() => setQuickMinutes(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "recall" ? "Active recall" : "Exam questions"}
          </h1>
          <p className="text-sm text-ink3 mt-0.5">
            {mode === "recall"
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
              setOrder(orderFor(value, ""));
            }}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : null}
      </header>

      <QuickSessionPicker onSelect={setQuickMinutes} />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={topicId}
          onChange={(e) => {
            setTopicId(e.target.value);
            // The queue is rebuilt for the new filter, so a stale cursor would
            // land on an unrelated question.
            setIndex(0);
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
        <Button size="sm" onClick={() => void generate()} disabled={generating}>
          {generating ? "Generating…" : "Generate similar questions"}
        </Button>
        {queue.length ? (
          <span className="text-xs text-ink3 ml-auto tabular-nums">
            {index + 1} of {queue.length}
          </span>
        ) : null}
      </div>

      {note ? <p className="text-xs text-ink3">{note}</p> : null}

      {mode === "recall" && current ? (
        <Panel className="card-2">
          <p className="text-xs text-ink2">
            <span className="font-semibold">Blank page first.</span> Write everything you can recall about{" "}
            {getTopic(current.topicIds[0] ?? "")?.title ?? "this topic"} before you read the question — then answer
            it. Retrieval before review is what makes this work.
          </p>
        </Panel>
      ) : null}

      {current ? (
        <>
          <QuestionRunner
            key={current.id}
            question={current}
            mode={mode}
            onFinished={() => {
              setCompleted((c) => c + 1);
              if (sessionId && completed === 0) void store.completeSession(sessionId);
            }}
          />
          <div className="flex justify-between gap-2">
            <Button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Previous
            </Button>
            <Button
              variant="primary"
              disabled={index >= queue.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next question
            </Button>
          </div>
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
              <Link href="/papers">
                <Button>Upload a paper</Button>
              </Link>
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
