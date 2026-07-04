"use client";

import { useState } from "react";
import type { Flashcard, LessonSection, QuizQuestion, Topic } from "@/lib/types";

interface Props {
  topic: Topic;
  cards: Flashcard[];
  due: number;
  mastery: number;
  quiz: QuizQuestion[] | undefined;
  lessonSections: LessonSection[] | undefined;
  notebookLink: string | undefined;
  busy: "cards" | "quiz" | "lesson" | undefined;
  onGenerateCards: () => void;
  onGenerateQuiz: () => void;
  onGenerateLesson: () => void;
  onStudy: () => void;
  onStartQuiz: () => void;
  onStartLesson: () => void;
  onSetNotebookLink: (url: string) => void;
  lessonsLocked?: boolean;
}

export default function TopicRow({
  topic,
  cards,
  due,
  mastery,
  quiz,
  lessonSections,
  notebookLink,
  busy,
  onGenerateCards,
  onGenerateQuiz,
  onGenerateLesson,
  onStudy,
  onStartQuiz,
  onStartLesson,
  onSetNotebookLink,
  lessonsLocked,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState(notebookLink ?? "");

  return (
    <div className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex flex-col gap-1">
          <p className="font-medium">{topic.title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {topic.id} · {cards.length} cards · {due} due · {mastery}% mastered
          </p>
        </div>
        <span
          className="shrink-0 text-zinc-400 transition-transform dark:text-zinc-500"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2 text-xs">
            {cards.length === 0 ? (
              <button
                onClick={onGenerateCards}
                disabled={busy === "cards"}
                className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {busy === "cards" ? "Generating…" : "Generate cards"}
              </button>
            ) : (
              <button
                onClick={onStudy}
                disabled={due === 0}
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
              >
                Study {due > 0 ? `(${due})` : ""}
              </button>
            )}

            {quiz ? (
              <button
                onClick={onStartQuiz}
                className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Quiz ({quiz.length})
              </button>
            ) : (
              <button
                onClick={onGenerateQuiz}
                disabled={busy === "quiz"}
                className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {busy === "quiz" ? "Generating…" : "Generate quiz"}
              </button>
            )}

            {lessonSections ? (
              <button
                onClick={onStartLesson}
                className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Lesson ({lessonSections.length})
              </button>
            ) : (
              <button
                onClick={onGenerateLesson}
                disabled={busy === "lesson" || lessonsLocked}
                className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {busy === "lesson" ? "Generating…" : "Generate lesson"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {notebookLink && !editingLink ? (
              <>
                <a
                  href={notebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Open in NotebookLM
                </a>
                <button
                  onClick={() => setEditingLink(true)}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Edit link
                </button>
              </>
            ) : editingLink ? (
              <>
                <input
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/…"
                  className="min-w-64 flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  onClick={() => {
                    onSetNotebookLink(linkDraft.trim());
                    setEditingLink(false);
                  }}
                  className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setLinkDraft(notebookLink ?? "");
                    setEditingLink(false);
                  }}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingLink(true)}
                className="text-zinc-500 hover:underline dark:text-zinc-400"
              >
                + NotebookLM link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
