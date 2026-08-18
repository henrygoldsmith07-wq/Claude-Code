"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { aiExtractQuestions, aiOcr } from "@/ai/client";
import { toBase64 } from "@/components/AnswerInput";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { tokenise } from "@/domain/marking";
import type { Paper, Question } from "@/domain/types";
import { useStore, useSubjects } from "@/state/store";
import { ExamConditionMode } from "@/components/ExamConditionMode";
import { QuestionRunner } from "@/components/QuestionRunner";
import { Button, EmptyState, Field, Panel, Pill, ProgressBar, SectionHeading, Segmented } from "@/components/ui";
import { ICON_SIZE, PhotoIcon, TimerIcon } from "@/components/icons";

// Past papers: upload, extract, map to topics, practise by topic, or sit a
// paper under full exam conditions. Extraction needs a model; everything after
// it does not, so a paper extracted once stays fully usable offline forever.

export default function PapersPage() {
  return (
    <Suspense fallback={null}>
      <Papers />
    </Suspense>
  );
}

function Papers() {
  const params = useSearchParams();
  const store = useStore();
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState(params.get("subject") ?? subjects[0]?.id ?? "");
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [examPaper, setExamPaper] = useState<Paper | null>(null);

  const papers = useMemo(
    () => store.papers.filter((p) => !subjectId || p.subjectId === subjectId),
    [store.papers, subjectId],
  );

  if (activePaper) {
    return <PaperSession paper={activePaper} onExit={() => setActivePaper(null)} />;
  }

  if (examPaper) {
    return <ExamConditionMode paper={examPaper} onExit={() => setExamPaper(null)} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Past papers</h1>
          <p className="text-sm text-ink3 mt-0.5">
            Upload a paper and its mark scheme, extract the questions, then practise them by topic or under full exam conditions.
          </p>
        </div>
        {subjects.length > 1 ? (
          <Segmented
            ariaLabel="Subject"
            value={subjectId}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : null}
      </header>

      <UploadPaper subjectId={subjectId} />

      <Panel className="space-y-2">
        <SectionHeading title="Full exam conditions" hint="A fixed clock, no in-paper help, and feedback only after submission." />
        <p className="text-sm text-ink2">
          Choose <span className="font-semibold">Full exam conditions</span> beside any extracted paper below. The run is timed to the selected paper format, saves each answer only when you submit, and records the marked paper for later review.
        </p>
      </Panel>

      <section>
        <SectionHeading title="Your papers" hint="Extracted questions join the practice pool automatically." />
        {papers.length ? (
          <ul className="card divide-y divide-line">
            {papers.map((paper) => {
              const attempted = store.attempts.filter((a) => paper.questionIds.includes(a.questionId));
              const scored = attempted.reduce((a, x) => a + x.awarded, 0);
              const possible = attempted.reduce((a, x) => a + x.max, 0);
              return (
                <li key={paper.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{paper.title}</p>
                    <p className="text-[11px] text-ink3">
                      {getSubject(paper.subjectId)?.name} · {paper.questionIds.length} questions ·{" "}
                      {paper.totalMarks} marks
                      {possible ? ` · scored ${scored}/${possible}` : ""}
                    </p>
                  </div>
                  <Pill tone={paper.status === "practised" ? "success" : undefined}>{paper.status}</Pill>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" disabled={!paper.questionIds.length} onClick={() => setActivePaper(paper)}>
                      Practise paper
                    </Button>
                    <Button size="sm" variant="primary" disabled={!paper.questionIds.length} onClick={() => setExamPaper(paper)}>
                      Full exam conditions
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No papers uploaded"
            body="Paste the text of a past paper, or photograph its pages. Questions are split out, mapped to topics and marked against the scheme. Extract one to unlock full exam conditions."
          />
        )}
      </section>
    </div>
  );
}

function UploadPaper({ subjectId }: { subjectId: string }) {
  const store = useStore();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [markScheme, setMarkScheme] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function photograph(files: FileList, into: (value: string) => void) {
    setBusy("ocr");
    const pages: string[] = [];
    for (const file of Array.from(files).slice(0, 12)) {
      const base64 = await toBase64(file);
      const result = await aiOcr(base64, file.type || "image/jpeg", "printed");
      if (result.data.text) pages.push(result.data.text);
      else setStatus(result.note ?? "Could not read that page.");
    }
    if (pages.length) into(pages.join("\n\n"));
    setBusy(null);
  }

  async function extract() {
    if (!text.trim() || !subjectId) return;
    setBusy("extract");
    setStatus(null);

    const combined = markScheme.trim() ? `${text}\n\n--- MARK SCHEME ---\n${markScheme}` : text;
    const result = await aiExtractQuestions(subjectId, combined);

    if (!result.data.questions.length) {
      setStatus(
        result.note
          ? `Extraction needs an AI provider — ${result.note}. The paper is saved, so you can extract it later.`
          : "No questions could be extracted from that text.",
      );
    }

    const paperId = crypto.randomUUID();
    const questions: Question[] = result.data.questions.map((generated, index) => ({
      id: crypto.randomUUID(),
      subjectId,
      topicIds: mapToTopics(subjectId, `${generated.stem} ${generated.parts.map((p) => p.prompt).join(" ")}`),
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
      origin: "past-paper",
      paperId,
      paperQuestionNumber: String(index + 1),
      createdAt: new Date().toISOString(),
    }));

    if (questions.length) await store.addQuestions(questions);

    const paper: Paper = {
      id: paperId,
      userId: store.userId,
      subjectId,
      title: title.trim() || `Paper uploaded ${new Date().toLocaleDateString("en-GB")}`,
      sourceText: text.slice(0, 60_000),
      markSchemeText: markScheme.slice(0, 60_000) || undefined,
      totalMarks: questions.reduce((a, q) => a + q.totalMarks, 0),
      questionIds: questions.map((q) => q.id),
      status: questions.length ? "extracted" : "uploaded",
      createdAt: new Date().toISOString(),
    };
    await store.addPaper(paper);

    if (questions.length) {
      setStatus(`Extracted ${questions.length} questions worth ${paper.totalMarks} marks, mapped to topics.`);
      setText("");
      setMarkScheme("");
      setTitle("");
    }
    setBusy(null);
  }

  return (
    <Panel className="space-y-3">
      <SectionHeading
        title="Upload a paper"
        hint="Paste the text, or photograph the pages and let OCR read them."
      />
      <Field label="Title" hint="For example: Summer 2024 Unit 3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="field text-sm" />
      </Field>
      <Field label="Question paper text">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste the paper here…"
          className="field nice-scroll text-sm"
        />
      </Field>
      <Field label="Mark scheme" hint="Optional, but marking is far more accurate with it.">
        <textarea
          value={markScheme}
          onChange={(e) => setMarkScheme(e.target.value)}
          rows={4}
          placeholder="Paste the mark scheme here…"
          className="field nice-scroll text-sm"
        />
      </Field>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="btn btn-secondary text-sm cursor-pointer">
          <PhotoIcon size={ICON_SIZE.md} aria-hidden />
          Photograph paper
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void photograph(e.target.files, (value) => setText((t) => `${t}\n${value}`.trim()));
              e.target.value = "";
            }}
          />
        </label>
        <label className="btn btn-secondary text-sm cursor-pointer">
          <PhotoIcon size={ICON_SIZE.md} aria-hidden />
          Photograph mark scheme
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length)
                void photograph(e.target.files, (value) => setMarkScheme((t) => `${t}\n${value}`.trim()));
              e.target.value = "";
            }}
          />
        </label>
        <Button variant="primary" onClick={() => void extract()} disabled={busy !== null || !text.trim()}>
          {busy === "extract" ? "Extracting…" : busy === "ocr" ? "Reading pages…" : "Extract questions"}
        </Button>
      </div>
      {status ? <p className="text-xs text-ink3">{status}</p> : null}
    </Panel>
  );
}

/**
 * Map an extracted question to spec topics by term overlap against each
 * topic's title and key points. Cheap, deterministic and offline; the student
 * can always re-file a question by practising it from the topic they expect.
 */
export function mapToTopics(subjectId: string, text: string, limit = 2): string[] {
  const words = tokenise(text);
  const scored = topicsFor(subjectId)
    .map((topic) => {
      const terms = tokenise(`${topic.title} ${topic.keyPoints.join(" ")}`);
      let overlap = 0;
      for (const term of terms) if (words.has(term)) overlap++;
      return { id: topic.id, score: overlap / Math.max(8, terms.size) };
    })
    .filter((row) => row.score > 0.02)
    .sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, limit).map((row) => row.id);
  return picked.length ? picked : [topicsFor(subjectId)[0]?.id].filter(Boolean);
}

function PaperSession({ paper, onExit }: { paper: Paper; onExit: () => void }) {
  const store = useStore();
  const [index, setIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [scores, setScores] = useState<{ awarded: number; max: number }[]>([]);

  // A paper is sat under timed conditions, so the clock has to advance on its
  // own rather than only when something else re-renders.
  useEffect(() => {
    const tick = setInterval(() => setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60_000)), 15_000);
    return () => clearInterval(tick);
  }, [startedAt]);

  const questions = useMemo(
    () => paper.questionIds.map((id) => store.questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q)),
    [paper.questionIds, store.questions],
  );
  const current = questions[index];
  const totalAwarded = scores.reduce((a, s) => a + s.awarded, 0);
  const totalMax = scores.reduce((a, s) => a + s.max, 0);

  async function finish() {
    await store.addPaper({ ...paper, status: "practised" });
    onExit();
  }

  if (!current) {
    const paperPct = totalMax ? totalAwarded / totalMax : 0;
    const predictedBefore = (() => {
      const subject = getSubject(paper.subjectId);
      const qs = paper.questionIds.map((id) => store.questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q));
      if (!subject || !qs.length) return null;
      const masteryMap = new Map(store.mastery.map((m) => [m.topicId, m.mastery]));
      const psId = paper.paperSpecId ?? subject.papers[0]?.id ?? "";
      return store.previewPaper(subject.id, psId, paper.questionIds);
    })();
    const calibration = predictedBefore && predictedBefore.predictedMarks !== totalAwarded
      ? `Simulation had predicted ${predictedBefore.predictedMarks}/${predictedBefore.totalMarks} — calibration will tighten next time.`
      : null;
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <SectionHeading title="Paper complete" hint={paper.title} />
        <Panel>
          <p className="text-3xl font-semibold tabular-nums">
            {totalAwarded}
            <span className="text-ink3 text-xl">/{totalMax || paper.totalMarks}</span>
          </p>
          <div className="mt-3">
            <ProgressBar value={paperPct} tone={paperPct >= 0.7 ? "success" : paperPct >= 0.5 ? "review" : "danger"} />
          </div>
          <p className="text-xs text-ink3 mt-3">
            {elapsedMinutes} minutes. Every dropped mark is now a mistake card in your review queue.
          </p>
          {calibration ? <p className="text-[11px] text-ink3 mt-2">{calibration} See Progress for the updated calibration.</p> : null}
        </Panel>
        <Button variant="primary" className="w-full" onClick={() => void finish()}>
          Finish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">{paper.title}</h1>
          <p className="text-[11px] text-ink3">
            Question {index + 1} of {questions.length} ·{" "}
            {getTopic(current.topicIds[0] ?? "")?.title ?? getSubject(current.subjectId)?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Pill tone={elapsedMinutes > 90 ? "danger" : undefined}>
            <TimerIcon size={ICON_SIZE.sm} aria-hidden />
            {elapsedMinutes} min
          </Pill>
          <Button size="sm" variant="ghost" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>

      <ProgressBar value={index / questions.length} />

      <QuestionRunner
        key={current.id}
        question={current}
        mode="paper"
        onFinished={(attempt) => setScores((prev) => [...prev, { awarded: attempt.awarded, max: attempt.max }])}
      />

      <Button variant="primary" className="w-full" onClick={() => setIndex((i) => i + 1)}>
        {index === questions.length - 1 ? "Finish paper" : "Next question"}
      </Button>
    </div>
  );
}
