"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getSubject, getTopic } from "@/domain/curriculum";
import { buildReviewQueue, isDue, previewIntervals, reinsert, todayIso } from "@/domain/scheduling";
import type { Card, RecallGrade } from "@/domain/types";
import { useStore } from "@/state/store";
import { Button, EmptyState, Panel, Pill, ProgressBar, SectionHeading } from "@/components/ui";
import { RichText } from "@/components/RichText";

// The review session. One card, one decision, no chrome competing for
// attention. Confidence is captured *before* the answer is revealed, because
// asked afterwards it measures hindsight rather than metacognition.

const GRADES: { grade: RecallGrade; label: string; hint: string }[] = [
  { grade: "again", label: "Again", hint: "Blanked" },
  { grade: "hard", label: "Hard", hint: "Struggled" },
  { grade: "good", label: "Good", hint: "Recalled" },
  { grade: "easy", label: "Easy", hint: "Instant" },
];

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewSession />
    </Suspense>
  );
}

function ReviewSession() {
  const params = useSearchParams();
  const store = useStore();
  const subjectId = params.get("subject");
  const topicId = params.get("topic");
  const mode = params.get("mode");
  const sessionId = params.get("session");

  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  // Time is accumulated per card rather than measured against a wall clock, so
  // a session left open in a background tab does not report an hour of work.
  const [done, setDone] = useState({ reviewed: 0, again: 0, totalMs: 0 });
  const cardShownAt = useRef(0);

  const pool = useMemo(() => {
    const today = todayIso();
    return store.cards.filter((card) => {
      if (!store.settings.subjectIds.includes(card.subjectId)) return false;
      if (subjectId && card.subjectId !== subjectId) return false;
      if (topicId && card.topicId !== topicId) return false;
      if (mode === "mistakes") return card.kind === "mistake" && !card.suspended;
      return isDue(card, today);
    });
  }, [store.cards, store.settings.subjectIds, subjectId, topicId, mode]);

  // The queue is built once, at mount: rebuilding it as cards are graded would
  // reshuffle the deck underneath the student mid-session.
  const [queue, setQueue] = useState<Card[]>(() => {
    const limit = mode === "mistakes" ? 20 : Math.max(10, Math.ceil(store.settings.sessionLengthMinutes * 2.5));
    return buildReviewQueue(pool, limit);
  });

  useEffect(() => {
    cardShownAt.current = Date.now();
  }, []);

  const current = queue[0];
  const total = queue.length + done.reviewed;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!current) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed) return;
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (index >= 0) void grade(GRADES[index].grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function grade(value: RecallGrade) {
    if (!current) return;
    const elapsed = cardShownAt.current ? Date.now() - cardShownAt.current : 0;
    await store.reviewCard(current, value, elapsed, confidence ?? undefined);

    // "Again" cards come back inside this session — tomorrow is too late to
    // repair a card you have just proved you cannot recall.
    const rest = queue.slice(1);
    setQueue(value === "again" ? reinsert(rest, current, 4) : rest);
    setDone((d) => ({
      reviewed: d.reviewed + 1,
      again: d.again + (value === "again" ? 1 : 0),
      totalMs: d.totalMs + elapsed,
    }));
    setRevealed(false);
    setConfidence(null);
    cardShownAt.current = Date.now();
  }

  if (!current) {
    return (
      <SessionSummary
        reviewed={done.reviewed}
        again={done.again}
        minutes={Math.max(1, Math.round(done.totalMs / 60_000))}
        sessionId={sessionId}
      />
    );
  }

  const topic = getTopic(current.topicId);
  const intervals = previewIntervals(current);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink3 truncate">
            {getSubject(current.subjectId)?.name} · {topic?.title}
          </p>
          <h1 className="text-sm font-semibold">
            {mode === "mistakes" ? "Mistake repair" : "Spaced repetition"}
          </h1>
        </div>
        <Link href="/">
          <Button size="sm" variant="ghost">
            End session
          </Button>
        </Link>
      </div>

      <ProgressBar value={total ? done.reviewed / total : 0} label={`${done.reviewed} of ${total}`} />

      <Panel className="min-h-[16rem] flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Pill>{cardKindLabel(current)}</Pill>
          {current.lapses > 2 ? <Pill tone="danger">Leech · {current.lapses} lapses</Pill> : null}
        </div>

        <div className="flex-1">
          <RichText className="text-base text-ink">{current.front}</RichText>

          {revealed ? (
            <div className="mt-5 pt-4 border-t border-line fade-in">
              <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-1.5">Answer</p>
              <RichText className="text-base">{current.back}</RichText>
            </div>
          ) : null}
        </div>

        {!revealed ? (
          <div className="mt-5 space-y-3">
            <div>
              <p className="text-[11px] text-ink3 mb-1.5">How confident are you, before you look?</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setConfidence(value as 1 | 2 | 3 | 4 | 5)}
                    aria-pressed={confidence === value}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-[8px] border transition-colors ${
                      confidence === value
                        ? "bg-accent text-onaccent border-transparent"
                        : "border-line text-ink3 hover:text-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={() => setRevealed(true)}>
              Show answer <span className="text-[10px] opacity-60">space</span>
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-4 gap-1.5">
            {GRADES.map((option, i) => (
              <button
                key={option.grade}
                onClick={() => void grade(option.grade)}
                className="card p-2 text-center hover:border-ink3 transition-colors"
              >
                <span className="block text-xs font-semibold text-ink">{option.label}</span>
                <span className="block text-[10px] text-ink3">{option.hint}</span>
                <span className="block text-[10px] text-ink3 tabular-nums mt-0.5">
                  {intervals[option.grade] === 0 ? "today" : `${intervals[option.grade]}d`}
                </span>
                <span className="sr-only">Press {i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {topic?.commonErrors.length && revealed ? (
        <p className="text-xs text-ink3">
          <span className="font-semibold text-ink2">Examiner note: </span>
          {topic.commonErrors[0]}
        </p>
      ) : null}
    </div>
  );
}

function cardKindLabel(card: Card): string {
  switch (card.kind) {
    case "cloze":
      return "Cloze";
    case "equation":
      return "Equation";
    case "image":
      return "Diagram";
    case "mistake":
      return "From a mistake";
    default:
      return card.origin === "ai" ? "AI generated" : "Recall";
  }
}

function SessionSummary({
  reviewed,
  again,
  minutes,
  sessionId,
}: {
  reviewed: number;
  again: number;
  minutes: number;
  sessionId: string | null;
}) {
  const store = useStore();
  const logged = useRef(false);

  useEffect(() => {
    // A ref, not state: marking the planned session done is a side effect that
    // must happen exactly once and has nothing to render.
    if (sessionId && reviewed > 0 && !logged.current) {
      logged.current = true;
      void store.completeSession(sessionId);
    }
  }, [sessionId, reviewed, store]);

  if (reviewed === 0) {
    return (
      <EmptyState
        title="Nothing due here"
        body="Spaced repetition deliberately leaves gaps — reviewing early wastes the effect. Pick another activity and come back when cards fall due."
        action={
          <Link href="/">
            <Button variant="primary">Back to today</Button>
          </Link>
        }
      />
    );
  }

  const accuracy = reviewed ? Math.round(((reviewed - again) / reviewed) * 100) : 0;
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <SectionHeading title="Session complete" hint="Every card is rescheduled by FSRS from how you graded it." />
      <Panel>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{reviewed}</p>
            <p className="text-[11px] text-ink3">reviewed</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{accuracy}%</p>
            <p className="text-[11px] text-ink3">recalled first time</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{minutes}</p>
            <p className="text-[11px] text-ink3">minutes</p>
          </div>
        </div>
        <p className="text-xs text-ink3 mt-4">
          {again > 0
            ? `${again} card${again === 1 ? "" : "s"} came back this session and will return sooner than the rest.`
            : "No lapses — those intervals just grew significantly."}
        </p>
      </Panel>
      <div className="flex gap-2">
        <Link href="/" className="flex-1">
          <Button variant="primary" className="w-full">
            What&apos;s next
          </Button>
        </Link>
        <Link href="/practice" className="flex-1">
          <Button className="w-full">Practise questions</Button>
        </Link>
      </div>
    </div>
  );
}
