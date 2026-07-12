'use client';

/**
 * Agentic workflows: rules that watch each OS's data (sense), decide when
 * something needs doing (decide), and either deep-link to the right system
 * or execute a one-click action that mutates the data directly (act).
 * Runs entirely client-side over the same localStorage the mini-apps use;
 * write() broadcasts DATA_EVENT so signals and tiles recompute live.
 */

import { read, write, Tone } from '@/lib/os/signals';
import { today, daysUntil, uid } from '@/lib/os/storage';
import { Bet, pipelineSeed, PIPELINE_KEY } from '@/lib/os/pipeline';

export interface Suggestion {
  id: string;
  os: 'study' | 'builder' | 'health' | 'money';
  text: string;
  tone: Tone;
  /** Where to act manually */
  href?: string;
  /** One-click execution — the agentic part */
  action?: { label: string; apply: () => void };
}

interface Exam { subject: string; date: string }
interface FocusSession { date: string; minutes: number }
interface GradeResult { subject: string; scorePct: number }
interface Idea { id: string; name: string; impact: number; effort: number }
interface Habit { id: string; name: string; history: string[] }
interface SavingsGoal { saved: number }
interface WishItem { id: string; name: string; price: number; priority: string; bought: boolean }

export function runWorkflows(scope: string): Suggestion[] {
  const out: Suggestion[] = [];
  const want = (os: Suggestion['os']) => scope === '' || scope === os;

  if (want('study')) {
    const exams = read<Exam[]>('os.study.exams', []);
    const nextExam = exams
      .filter((e) => daysUntil(e.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const focusToday = read<FocusSession[]>('os.study.focus', [])
      .filter((s) => s.date === today())
      .reduce((s, x) => s + x.minutes, 0);
    if (nextExam && daysUntil(nextExam.date) <= 7 && focusToday < 25) {
      out.push({
        id: 'study-crunch',
        os: 'study',
        text: `${nextExam.subject} exam in ${daysUntil(nextExam.date)}d and only ${focusToday} focused minutes today.`,
        tone: 'bad',
        href: '/os/study/focus-timer',
        action: undefined,
      });
    }

    const grades = read<GradeResult[]>('os.study.grades', []);
    const bySubject = new Map<string, number[]>();
    grades.forEach((g) => bySubject.set(g.subject, [...(bySubject.get(g.subject) ?? []), g.scorePct]));
    for (const [subject, scores] of bySubject) {
      const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
      if (avg < 60) {
        out.push({
          id: `study-weak-${subject}`,
          os: 'study',
          text: `${subject} is averaging ${avg.toFixed(0)}% — weight it in the revision rotation.`,
          tone: 'warn',
          href: '/os/study/exam-planner',
        });
      }
    }

    const cards = read<{ front: string; right: number; wrong: number }[]>('os.study.quickcards', []);
    const weak = cards.filter((c) => c.wrong > c.right).length;
    if (weak >= 3) {
      out.push({
        id: 'study-weak-cards',
        os: 'study',
        text: `${weak} flashcards are net-wrong — a review pass would clear them.`,
        tone: 'warn',
        href: '/os/study/quick-cards',
      });
    }
  }

  if (want('builder')) {
    const ideas = read<Idea[]>('os.builder.ideas', []);
    const hot = ideas.filter((i) => i.impact / i.effort >= 2)
      .sort((a, b) => b.impact / b.effort - a.impact / a.effort)[0];
    if (hot) {
      out.push({
        id: `builder-promote-${hot.id}`,
        os: 'builder',
        text: `"${hot.name}" scores ${(hot.impact / hot.effort).toFixed(1)} impact÷effort — that's a bet worth placing.`,
        tone: 'good',
        href: '/os/builder/idea-vault',
        action: {
          label: 'Promote to pipeline',
          apply: () => {
            const pipeline = read<Bet[]>(PIPELINE_KEY, pipelineSeed);
            write(PIPELINE_KEY, [...pipeline, { id: uid(), name: hot.name, stage: 'idea' }]);
            write('os.builder.ideas', ideas.filter((i) => i.id !== hot.id));
          },
        },
      });
    }

    const bets = read<Bet[]>(PIPELINE_KEY, pipelineSeed);
    const building = bets.filter((b) => b.stage === 'building');
    if (building.length > 2) {
      out.push({
        id: 'builder-wip',
        os: 'builder',
        text: `${building.length} bets in Building — volume comes from finishing, not starting. Ship or kill one.`,
        tone: 'warn',
        href: '/os/builder/ship-pipeline',
      });
    }

    const launch = read<Record<string, string[]>>('os.builder.launch', {});
    const nearly = Object.entries(launch)
      .filter(([, items]) => items.length >= 5 && items.length < 8)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (nearly) {
      out.push({
        id: `builder-finish-${nearly[0]}`,
        os: 'builder',
        text: `${nearly[0]} is ${nearly[1].length}/8 through launch — closest to done, finish it first.`,
        tone: 'good',
        href: '/os/builder/launch-checklist',
      });
    }
  }

  if (want('health')) {
    const habits = read<Habit[]>('os.health.habits', []);
    const t = today();
    const yesterday = (() => {
      const d = new Date(t + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const atRisk = habits.find((h) => !h.history.includes(t) && h.history.includes(yesterday));
    if (atRisk) {
      out.push({
        id: `health-streak-${atRisk.id}`,
        os: 'health',
        text: `"${atRisk.name}" has a live streak and isn't done today.`,
        tone: 'warn',
        href: '/os/health/habits',
        action: {
          label: 'Mark done',
          apply: () => {
            write('os.health.habits', habits.map((h) =>
              h.id === atRisk.id ? { ...h, history: [...h.history, t] } : h
            ));
          },
        },
      });
    }

    const water = read<Record<string, number>>('os.health.water', {});
    const target = read<number>('os.health.water.target', 8);
    const glasses = water[t] ?? 0;
    if (new Date().getHours() >= 12 && glasses < target / 2) {
      out.push({
        id: 'health-water',
        os: 'health',
        text: `Past midday and only ${glasses}/${target} glasses of water.`,
        tone: 'warn',
        href: '/os/health/water',
        action: {
          label: 'Log a glass',
          apply: () => write('os.health.water', { ...water, [t]: glasses + 1 }),
        },
      });
    }

    const logs = read<{ date: string; sleepHours: number }[]>('os.health.fitness', []);
    const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    if (recent.length >= 3) {
      const avg = recent.reduce((s, l) => s + l.sleepHours, 0) / recent.length;
      if (avg < 6.5) {
        out.push({
          id: 'health-sleep',
          os: 'health',
          text: `Averaging ${avg.toFixed(1)}h sleep — retention drops before you feel it. Protect tonight.`,
          tone: 'bad',
          href: '/os/health/fitness',
        });
      }
    }
  }

  if (want('money')) {
    const cats = read<{ name: string; planned: number }[]>('os.money.budget.categories', []);
    const spends = read<{ date: string; category: string; amount: number }[]>('os.money.budget.spends', []);
    const month = today().slice(0, 7);
    for (const cat of cats) {
      const spent = spends
        .filter((s) => s.date.startsWith(month) && s.category === cat.name)
        .reduce((s, x) => s + x.amount, 0);
      if (cat.planned > 0 && spent > cat.planned) {
        out.push({
          id: `money-over-${cat.name}`,
          os: 'money',
          text: `"${cat.name}" is £${(spent - cat.planned).toFixed(0)} over budget this month.`,
          tone: 'bad',
          href: '/os/money/budget',
        });
      }
    }

    const saved = read<SavingsGoal[]>('os.money.savings', []).reduce((s, g) => s + g.saved, 0);
    const wishlist = read<WishItem[]>('os.money.wishlist', []);
    const affordable = wishlist
      .filter((i) => !i.bought && i.priority === 'must' && i.price <= saved)
      .sort((a, b) => a.price - b.price)[0];
    if (affordable) {
      out.push({
        id: `money-afford-${affordable.id}`,
        os: 'money',
        text: `"${affordable.name}" (£${affordable.price.toFixed(0)}) is a must-have you can now cover from savings.`,
        tone: 'good',
        href: '/os/money/wishlist',
      });
    }
  }

  return out;
}
