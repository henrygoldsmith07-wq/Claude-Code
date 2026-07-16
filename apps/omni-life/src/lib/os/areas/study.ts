import type { OsNode } from '@/lib/os/tree';

export const studyOs: OsNode = {
  slug: 'study',
  name: 'Study OS',
  icon: '📚',
  tagline: 'A-levels, NotebookLM, and everything revision.',
  description:
    'Home for WJEC A-level work. The NotebookLM OS organises notebooks ' +
    'per subject; the WJEC Study Hub carries flashcards and spaced ' +
    'repetition. This OS doubles as a product surface — pieces of it are ' +
    'meant to graduate into tools other students use.',
  status: 'live',
  children: [
    {
      slug: 'notebooklm',
      name: 'NotebookLM OS',
      icon: '📓',
      tagline: 'One card per notebook, organised by subject.',
      description:
        'NotebookLM has no public API, so this level is an organised ' +
        'launcher: each card is one notebook with its role noted here. ' +
        'Replace the generic links with each notebook’s share URL.',
      status: 'live',
      children: [
        { slug: 'chemistry', name: 'Chemistry Notebook', icon: '🧪', tagline: 'WJEC Chemistry sources, summaries, audio overviews.', status: 'live', href: 'https://notebooklm.google.com' },
        { slug: 'physics', name: 'Physics Notebook', icon: '🌌', tagline: 'WJEC Physics sources and topic breakdowns.', status: 'live', href: 'https://notebooklm.google.com' },
        { slug: 'biology', name: 'Biology Notebook', icon: '🧬', tagline: 'WJEC Biology sources and revision material.', status: 'live', href: 'https://notebooklm.google.com' },
        { slug: 'maths', name: 'Maths Notebook', icon: '📐', tagline: 'WJEC Maths worked examples and method notes.', status: 'live', href: 'https://notebooklm.google.com' },
      ],
    },
    {
      slug: 'wjec-study-hub',
      name: 'WJEC Study Hub',
      icon: '🗂️',
      tagline: 'FSRS flashcards, interleaved practice, quizzes.',
      description:
        'Already built: evidence-based revision app with spaced ' +
        'repetition (FSRS), interleaving, and Claude-generated content. ' +
        'Deploy it and point this tile at the live URL.',
      status: 'built',
      repoPath: 'apps/wjec-study-app',
    },
    { slug: 'exam-planner', name: 'Exam Planner', icon: '⏳', tagline: 'Exam dates, countdowns, revision timetable.', status: 'live' },
    { slug: 'notes-vault', name: 'Notes Vault', icon: '🗃️', tagline: 'Class notes, past papers, mark schemes.', status: 'live' },
    { slug: 'focus-timer', name: 'Focus Timer', icon: '⏲️', tagline: 'Pomodoro blocks; only completed ones count.', status: 'live' },
    { slug: 'grades', name: 'Grade Tracker', icon: '📊', tagline: 'Mock and test marks per subject, trend visible.', status: 'live' },
    { slug: 'quick-cards', name: 'Quick Cards', icon: '🃏', tagline: 'Scrappy flashcards for today’s facts.', status: 'live' },
    { slug: 'reading-list', name: 'Reading List', icon: '📖', tagline: 'Books, articles, videos queued for study.', status: 'live' },
    { slug: 'question-bank', name: 'Question Bank', icon: '❓', tagline: 'Things to ask the teacher before they cost marks.', status: 'live' },
    { slug: 'study-goals', name: 'Study Goals', icon: '🎯', tagline: 'Weekly targets with counters — 10 past papers, etc.', status: 'live' },
  ],
};
