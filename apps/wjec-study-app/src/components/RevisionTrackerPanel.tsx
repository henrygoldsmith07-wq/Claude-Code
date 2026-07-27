"use client";

import { Fragment } from "react";
import { SUBJECTS, topicsForSubject } from "@/lib/curriculum";
import { masteryPercent, recentAttemptsForTopic } from "@/lib/stats";
import type { Flashcard, QuizAttempt } from "@/lib/types";

interface Props {
  cardsForTopic: (topicId: string) => Flashcard[];
  quizAttempts: QuizAttempt[];
  onStudyTopic: (topicId: string) => void;
}

const REVIEW_COLUMNS = 5;

// Mirrors the physical planner's revision tracker: each topic is a row of
// five review boxes that fill in as you revise, tinting amber when a topic
// is freshly met and deepening to green once it's genuinely mastered — so
// at a glance you see which topics still need another pass.
type Confidence = "empty" | "amber" | "getting" | "green";

function confidenceOf(mastery: number, hasCards: boolean): Confidence {
  if (!hasCards) return "empty";
  if (mastery >= 100) return "green";
  if (mastery >= 45) return "getting";
  return "amber";
}

const FILL: Record<Exclude<Confidence, "empty">, string> = {
  amber: "#e8a13c",
  getting: "#c9b25a",
  green: "#6e9a6a",
};

function boxesFilled(cards: Flashcard[]): number {
  if (cards.length === 0) return 0;
  const avgReps = cards.reduce((sum, c) => sum + c.reps, 0) / cards.length;
  return Math.max(0, Math.min(REVIEW_COLUMNS, Math.round(avgReps)));
}

export default function RevisionTrackerPanel({ cardsForTopic, quizAttempts, onStudyTopic }: Props) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(40,34,26,0.06),0_10px_28px_rgba(40,34,26,0.08)]">
      <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--ink)] pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Pillar One</p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)]">Revision Tracker</h2>
        </div>
        <p className="max-w-[34ch] text-right font-display text-[13px] italic leading-snug text-[var(--ink-2)]">
          Keep revisiting the topics that aren&rsquo;t green yet; stop re-studying the ones that already are.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--ink-2)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm border border-[var(--line)]" /> Not started
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: FILL.amber }} /> Just met it
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: FILL.getting }} /> Getting there
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: FILL.green }} /> Confident
        </span>
        <span className="ml-auto text-[var(--ink-3)]">Boxes fill as your cards accumulate reviews.</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse tabular">
          <thead>
            <tr>
              <th className="border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-2)]">
                Topic
              </th>
              <th className="w-16 border border-[var(--line)] bg-[var(--surface-2)] px-2 py-2 text-center text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-2)]">
                Mastery
              </th>
              {Array.from({ length: REVIEW_COLUMNS }).map((_, i) => (
                <th
                  key={i}
                  className="w-11 border border-[var(--line)] bg-[var(--surface-2)] px-2 py-2 text-center text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-2)]"
                >
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUBJECTS.map((subject) => {
              const topics = topicsForSubject(subject.id);
              return (
                <Fragment key={subject.id}>
                  <tr>
                    <td
                      colSpan={2 + REVIEW_COLUMNS}
                      className="border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 font-display text-sm font-bold text-[var(--accent)]"
                    >
                      {subject.name}
                    </td>
                  </tr>
                  {topics.map((topic) => {
                    const cards = cardsForTopic(topic.id);
                    const mastery = masteryPercent(cards, recentAttemptsForTopic(quizAttempts, topic.id));
                    const conf = confidenceOf(mastery, cards.length > 0);
                    const filled = boxesFilled(cards);
                    return (
                      <tr key={topic.id} className="group">
                        <td className="border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--ink)]">
                          <button
                            onClick={() => onStudyTopic(topic.id)}
                            className="text-left hover:text-[var(--accent)] hover:underline"
                          >
                            {topic.title}
                          </button>
                        </td>
                        <td className="border border-[var(--line)] px-2 py-1.5 text-center text-[11px] text-[var(--ink-2)]">
                          {cards.length === 0 ? "—" : `${mastery}%`}
                        </td>
                        {Array.from({ length: REVIEW_COLUMNS }).map((_, i) => {
                          const isFilled = i < filled && conf !== "empty";
                          return (
                            <td key={i} className="border border-[var(--line)] p-0">
                              <div
                                className="mx-auto my-1 h-5 w-7 rounded-sm border"
                                style={
                                  isFilled
                                    ? { backgroundColor: FILL[conf], borderColor: "rgba(40,34,26,0.15)" }
                                    : {
                                        borderColor: "#d3cdc2",
                                        backgroundImage:
                                          "repeating-linear-gradient(-45deg, transparent 0 5px, rgba(40,34,26,0.04) 5px 6px)",
                                      }
                                }
                                aria-label={isFilled ? `Review ${i + 1} done` : `Review ${i + 1} not done`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
