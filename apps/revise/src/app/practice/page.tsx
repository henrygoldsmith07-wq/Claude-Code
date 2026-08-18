"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { aiGenerateQuestions } from "@/ai/client";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { delayedFarTransferRetests } from "@/domain/delayed-far-transfer";
import { todayIso } from "@/domain/scheduling";
import { buildPostSessionClosure } from "@/domain/post-session-closure";
import type { Attempt, Question } from "@/domain/types";
import { useStore, useSubjects } from "@/state/store";
import { PostSessionClosure } from "@/components/PostSessionClosure";
import { QuestionRunner, type QuestionDraft } from "@/components/QuestionRunner";
import { QuestionNavigator } from "@/components/QuestionNavigator";
import { parseQuickSessionMinutes, type QuickSessionMinutes } from "@/domain/quick-session";
import { QuickSessionMode, QuickSessionPicker } from "@/components/QuickSessionMode";
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
  const retestParam = params.get("retest");
  const mode = params.get("mode") === "recall" ? "recall" : "practice";
  const today = todayIso();
  const farTransferRetests = useMemo(
    () => delayedFarTransferRetests({ attempts: store.attempts, questions: store.questions, today }),
    [store.attempts, store.questions, today],
  );
  const farTransferRetest = retestParam
    ? farTransferRetests.find((retest) => retest.retestId === retestParam && retest.status !== "completed")
    : undefined;
  const requestedQuestionParam = farTransferRetest?.candidateQuestionId ?? questionParam;

  const [subjectId, setSubjectId] = useState(subjectParam ?? farTransferRetest?.subjectId ?? subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState(topicParam ?? farTransferRetest?.topicIds[0] ?? "");
  const quickParam = params.get("quick");
  const [quickMinutes, setQuickMinutes] = useState<QuickSessionMinutes | null>(() => parseQuickSessionMinutes(quickParam));
  const [index, setIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sessionAttempts, setSessionAttempts] = useState<Attempt[]>([]);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, QuestionDraft>>({});
  const [closed, setClosed] = useState(false);
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const closing = useRef(false);
  const [finishing, setFinishing] = useState(false);

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
    if (requestedQuestionParam) pool = pool.filter((q) => q.id === requestedQuestionParam);
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

  function resetSession() {
    setSessionAttempts([]);
    setQuestionDrafts({});
    setClosed(false);
    setSessionElapsedMs(0);
    setSessionStartedAt(Date.now());
    closing.current = false;
    setFinishing(false);
  }

  async function finishSession() {
    if (!sessionAttempts.length || closing.current) return;
    closing.current = true;
    setFinishing(true);
    setSessionElapsedMs(Date.now() - sessionStartedAt);
    if (sessionId) await store.completeSession(sessionId);
    setClosed(true);
  }

  const sessionAwarded = sessionAttempts.reduce((sum, attempt) => sum + attempt.awarded, 0);
  const sessionAvailable = sessionAttempts.reduce((sum, attempt) => sum + attempt.max, 0);
  const closure = buildPostSessionClosure({
    session: "practice",
    attempted: sessionAttempts.length,
    total: queue.length,
    awarded: sessionAwarded,
    available: sessionAvailable,
    elapsedMs: sessionElapsedMs,
  });
  const answered = queue.map((question) => sessionAttempts.some((attempt) => attempt.questionId === question.id));
  const drafted = queue.map((question) => {
    const draft = questionDrafts[question.id];
    return Boolean(draft && (draft.choice !== null || Object.values(draft.answers).some((answer) => answer.trim())));
  });
  const currentAnswered = current ? answered[index] : false;

  if (closed) {
    return (
      <PostSessionClosure
        closure={closure}
        hint="Your answers are recorded and dropped marks are available in the mistake queue."
        secondary={{ href: "/practice", label: "Practise another topic" }}
      />
    );
  }

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
      <header className="space-y-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "recall" ? "Active recall" : "Exam questions"}
          </h1>
          <p className="text-sm text-ink3 mt-0.5">
            {mode === "recall"
              ? "Answer from memory with nothing in front of you, then get it marked."
              : "Answer as you would in the exam. Every dropped mark becomes a card."}
          </p>
        </div>
        {subjects.length > 1 && !farTransferRetest ? (
          <div className="w-full sm:w-auto max-w-full overflow-x-auto nice-scroll pb-1">
            <Segmented
              ariaLabel="Subject"
              value={subjectId}
              onChange={(value) => {
                setSubjectId(value);
                setTopicId("");
                setIndex(0);
                setOrder(orderFor(value, ""));
                resetSession();
              }}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
        ) : null}
        {sessionAttempts.length ? (
          <Button size="sm" variant="primary" onClick={() => void finishSession()} disabled={finishing}>
            Finish session
          </Button>
        ) : null}
      </header>

      {farTransferRetest ? (
        <Panel className="border-accent bg-accentsoft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Pill tone={farTransferRetest.status === "due" ? "review" : "accent"}>
                  {farTransferRetest.status === "due" ? "Due now" : `Due ${farTransferRetest.scheduledFor}`}
                </Pill>
                <p className="text-sm font-semibold text-ink">Delayed far-transfer retest</p>
              </div>
              <p className="text-xs text-ink2 mt-2">
                A new-context question checks whether your original success on {getTopic(farTransferRetest.topicIds[0] ?? "")?.title ?? "this topic"} transfers after a delay.
              </p>
            </div>
            <Link href="/practice">
              <Button size="sm">Leave retest</Button>
            </Link>
          </div>
        </Panel>
      ) : null}

      <QuickSessionPicker onSelect={setQuickMinutes} />

      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
        <select
          value={topicId}
          disabled={Boolean(farTransferRetest)}
          onChange={(e) => {
            setTopicId(e.target.value);
            // The queue is rebuilt for the new filter, so a stale cursor would
            // land on an unrelated question.
            setIndex(0);
            setOrder(orderFor(subjectId, e.target.value));
            resetSession();
          }}
          className="field field-inline text-sm w-full sm:w-auto"
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
        <Button size="sm" className="w-full sm:w-auto" onClick={() => void generate()} disabled={generating || Boolean(farTransferRetest)}>
          {generating ? "Generating…" : "Generate similar questions"}
        </Button>
        {queue.length ? (
          <span className="text-xs text-ink3 sm:ml-auto justify-self-end tabular-nums">
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
          <QuestionNavigator
            currentIndex={index}
            total={queue.length}
            answered={answered}
            drafted={drafted}
            onSelect={setIndex}
            onPrevious={() => setIndex((i) => Math.max(0, i - 1))}
            onNext={() => {
              if (index >= queue.length - 1) void finishSession();
              else setIndex((i) => Math.min(queue.length - 1, i + 1));
            }}
            previousDisabled={index === 0}
            nextDisabled={index >= queue.length - 1 && !currentAnswered}
            nextLabel={index >= queue.length - 1 ? "Finish session" : currentAnswered ? "Next question" : "Skip question"}
            controlsClassName="grid grid-cols-2 gap-2"
          />
          <QuestionRunner
            key={current.id}
            question={current}
            mode={mode}
            farTransfer={farTransferRetest}
            draft={questionDrafts[current.id]}
            onDraftChange={(draft) => setQuestionDrafts((previous) => ({ ...previous, [current.id]: draft }))}
            onFinished={(attempt) => {
              setSessionAttempts((previous) => [
                ...previous.filter((existing) => existing.questionId !== attempt.questionId),
                attempt,
              ]);
              setQuestionDrafts((previous) => {
                const next = { ...previous };
                delete next[attempt.questionId];
                return next;
              });
            }}
          />
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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="primary" className="w-full sm:w-auto" onClick={() => void generate()} disabled={generating}>
                Generate questions
              </Button>
              <Link href="/papers">
                <Button className="w-full sm:w-auto">Upload a paper</Button>
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
