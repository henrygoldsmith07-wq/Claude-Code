'use client';

/**
 * The hierarchy's nervous system. Every mini-app stores its data under a
 * known localStorage key; each entry here condenses that data into one
 * "signal" (a headline stat with a tone). collectSignals() then rolls
 * signals up the tree — a sub-OS shows its children's signals, and the
 * Life OS root shows the top signal from every area — so data entered at
 * the bottom is visible all the way up the chain.
 */

import { OsNode } from '@/lib/os/tree';
import { today, daysUntil } from '@/lib/os/storage';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Signal {
  text: string;
  tone: Tone;
}

/** Fired whenever a workflow mutates OS data, so open views recompute. */
export const DATA_EVENT = 'os-data-changed';

export function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(DATA_EVENT));
  } catch {
    // storage unavailable — the action just doesn't persist
  }
}

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

/** One reader per system, keyed by the node's path below /os. */
const leafSignals: Record<string, () => Signal | null> = {
  'study/exam-planner': () => {
    const exams = read<{ subject: string; date: string }[]>('os.study.exams', []);
    const next = exams
      .filter((e) => daysUntil(e.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next) return null;
    const days = daysUntil(next.date);
    return {
      text: days === 0 ? `${next.subject} exam TODAY` : `Next exam: ${next.subject} in ${days}d`,
      tone: days <= 7 ? 'bad' : days <= 30 ? 'warn' : 'good',
    };
  },
  'study/focus-timer': () => {
    const sessions = read<{ date: string; minutes: number }[]>('os.study.focus', []);
    const mins = sessions.filter((s) => s.date === today()).reduce((s, x) => s + x.minutes, 0);
    return mins > 0 ? { text: `${mins} min focused today`, tone: 'good' } : null;
  },
  'study/grades': () => {
    const results = read<{ scorePct: number }[]>('os.study.grades', []);
    if (results.length === 0) return null;
    const avg = results.reduce((s, r) => s + r.scorePct, 0) / results.length;
    return {
      text: `Avg mark ${avg.toFixed(0)}%`,
      tone: avg >= 80 ? 'good' : avg >= 60 ? 'warn' : 'bad',
    };
  },
  'study/quick-cards': () => {
    const cards = read<{ right: number; wrong: number }[]>('os.study.quickcards', []);
    if (cards.length === 0) return null;
    const right = cards.reduce((s, c) => s + c.right, 0);
    const total = right + cards.reduce((s, c) => s + c.wrong, 0);
    return {
      text: `${cards.length} cards${total > 0 ? ` · ${Math.round((right / total) * 100)}% right` : ''}`,
      tone: 'neutral',
    };
  },
  'study/notes-vault': () => {
    const notes = read<unknown[]>('os.study.notes', []);
    return notes.length > 0 ? { text: `${notes.length} filed in vault`, tone: 'neutral' } : null;
  },
  'builder/ship-pipeline': () => {
    const bets = read<{ stage: string }[]>('os.builder.pipeline', []);
    if (bets.length === 0) return null;
    const building = bets.filter((b) => b.stage === 'building').length;
    const shipped = bets.filter((b) => b.stage === 'shipped' || b.stage === 'double-down').length;
    return { text: `${building} building · ${shipped} shipped`, tone: 'neutral' };
  },
  'builder/idea-vault': () => {
    const ideas = read<{ name: string }[]>('os.builder.ideas', []);
    return ideas.length > 0 ? { text: `${ideas.length} ideas vaulted`, tone: 'neutral' } : null;
  },
  'builder/launch-checklist': () => {
    const progress = read<Record<string, string[]>>('os.builder.launch', {});
    const launched = Object.values(progress).filter((items) => items.length >= 8).length;
    const started = Object.keys(progress).length;
    if (started === 0) return null;
    return {
      text: `${launched}/8 apps fully launched`,
      tone: launched > 0 ? 'good' : 'warn',
    };
  },
  'health/habits': () => {
    const habits = read<{ history: string[] }[]>('os.health.habits', []);
    if (habits.length === 0) return null;
    const done = habits.filter((h) => h.history.includes(today())).length;
    return {
      text: `Habits ${done}/${habits.length} today`,
      tone: done === habits.length ? 'good' : done > 0 ? 'warn' : 'bad',
    };
  },
  'health/fitness': () => {
    const logs = read<{ date: string; sleepHours: number }[]>('os.health.fitness', []);
    if (logs.length === 0) return null;
    const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const avg = recent.reduce((s, l) => s + l.sleepHours, 0) / recent.length;
    return {
      text: `${avg.toFixed(1)}h avg sleep`,
      tone: avg >= 7.5 ? 'good' : avg >= 6.5 ? 'warn' : 'bad',
    };
  },
  'health/water': () => {
    const log = read<Record<string, number>>('os.health.water', {});
    const target = read<number>('os.health.water.target', 8);
    const count = log[today()] ?? 0;
    if (count === 0) return null;
    return { text: `Water ${count}/${target}`, tone: count >= target ? 'good' : 'warn' };
  },
  'health/meals': () => {
    const meals = read<{ date: string }[]>('os.health.meals', []);
    const n = meals.filter((m) => m.date === today()).length;
    return n > 0 ? { text: `${n} meal${n === 1 ? '' : 's'} logged today`, tone: 'neutral' } : null;
  },
  'health/screen-time': () => {
    const log = read<Record<string, number>>('os.health.screentime', {});
    const target = read<number>('os.health.screentime.target', 3);
    const days = Object.entries(log).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
    if (days.length === 0) return null;
    const avg = days.reduce((s, [, h]) => s + h, 0) / days.length;
    return {
      text: `${avg.toFixed(1)}h/day screens`,
      tone: avg <= target ? 'good' : 'bad',
    };
  },
  'money/income': () => {
    const incomes = read<{ date: string; amount: number }[]>('os.money.income', []);
    const month = today().slice(0, 7);
    const total = incomes.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
    return total > 0 ? { text: `${gbp(total)} earned this month`, tone: 'good' } : null;
  },
  'money/budget': () => {
    const cats = read<{ planned: number }[]>('os.money.budget.categories', []);
    const spends = read<{ date: string; amount: number }[]>('os.money.budget.spends', []);
    if (cats.length === 0) return null;
    const planned = cats.reduce((s, c) => s + c.planned, 0);
    const month = today().slice(0, 7);
    const spent = spends.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.amount, 0);
    return {
      text: `Spent ${gbp(spent)} of ${gbp(planned)}`,
      tone: spent <= planned ? 'good' : 'bad',
    };
  },
  'money/savings': () => {
    const goals = read<{ saved: number }[]>('os.money.savings', []);
    const saved = goals.reduce((s, g) => s + g.saved, 0);
    return saved > 0 ? { text: `${gbp(saved)} saved`, tone: 'good' } : null;
  },
  'study/reading-list': () => {
    const items = read<{ status: string }[]>('os.study.reading', []);
    const reading = items.filter((i) => i.status === 'reading').length;
    const queued = items.filter((i) => i.status === 'queued').length;
    if (reading + queued === 0) return null;
    return { text: `${reading} reading · ${queued} queued`, tone: 'neutral' };
  },
  'study/question-bank': () => {
    const open = read<{ resolved: boolean }[]>('os.study.questions', []).filter((q) => !q.resolved).length;
    return open > 0 ? { text: `${open} open question${open === 1 ? '' : 's'}`, tone: 'warn' } : null;
  },
  'study/study-goals': () => {
    const goals = read<{ target: number; done: number }[]>('os.study.goals', []);
    if (goals.length === 0) return null;
    const hit = goals.filter((g) => g.done >= g.target).length;
    return {
      text: `Goals ${hit}/${goals.length} hit`,
      tone: hit === goals.length ? 'good' : 'neutral',
    };
  },
  'builder/bug-tracker': () => {
    const open = read<{ severity: string; fixed: boolean }[]>('os.builder.bugs', []).filter((b) => !b.fixed);
    if (open.length === 0) return null;
    return {
      text: `${open.length} open bug${open.length === 1 ? '' : 's'}`,
      tone: open.some((b) => b.severity === 'high') ? 'bad' : 'warn',
    };
  },
  'builder/experiments': () => {
    const running = read<{ status: string }[]>('os.builder.experiments', []).filter((e) => e.status === 'running').length;
    return running > 0 ? { text: `${running} experiment${running === 1 ? '' : 's'} running`, tone: 'neutral' } : null;
  },
  'builder/tech-debt': () => {
    const owed = read<{ pain: number; cleared: boolean }[]>('os.builder.debt', []).filter((d) => !d.cleared);
    if (owed.length === 0) return null;
    return {
      text: `${owed.length} debt item${owed.length === 1 ? '' : 's'}`,
      tone: owed.some((d) => d.pain >= 3) ? 'bad' : 'warn',
    };
  },
  'health/steps': () => {
    const log = read<Record<string, number>>('os.health.steps', {});
    const target = read<number>('os.health.steps.target', 8000);
    const steps = log[today()];
    if (steps === undefined) return null;
    return {
      text: `${steps.toLocaleString()} steps`,
      tone: steps >= target ? 'good' : 'neutral',
    };
  },
  'health/mindfulness': () => {
    const mins = read<{ date: string; minutes: number }[]>('os.health.mindfulness', [])
      .filter((s) => s.date === today()).reduce((s, x) => s + x.minutes, 0);
    return mins > 0 ? { text: `${mins} min mindful today`, tone: 'good' } : null;
  },
  'health/gratitude': () => {
    const n = read<{ date: string }[]>('os.health.gratitude', []).filter((e) => e.date === today()).length;
    if (n === 0) return null;
    return { text: `Gratitude ${Math.min(n, 3)}/3`, tone: n >= 3 ? 'good' : 'neutral' };
  },
  'money/owed': () => {
    const open = read<{ amount: number; direction: string; settled: boolean }[]>('os.money.owed', [])
      .filter((i) => !i.settled);
    if (open.length === 0) return null;
    const net = open.reduce((s, i) => s + (i.direction === 'they-owe' ? i.amount : -i.amount), 0);
    return {
      text: `Net ${net >= 0 ? '+' : '−'}${gbp(Math.abs(net))} owed`,
      tone: net >= 0 ? 'good' : 'bad',
    };
  },
  'money/accounts': () => {
    const accounts = read<{ balance: number }[]>('os.money.accounts', []);
    if (accounts.length === 0) return null;
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    return { text: `Net worth ${gbp(total)}`, tone: total >= 0 ? 'good' : 'bad' };
  },
  'money/bills': () => {
    const bills = read<{ name: string; dueDay: number }[]>('os.money.bills', []);
    if (bills.length === 0) return null;
    const now = new Date();
    const soonest = bills
      .map((b) => {
        const due = new Date(now.getFullYear(), now.getMonth(), b.dueDay);
        if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due.setMonth(due.getMonth() + 1);
        const days = Math.round((due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
        return { name: b.name, days };
      })
      .sort((a, b) => a.days - b.days)[0];
    return {
      text: soonest.days === 0 ? `${soonest.name} due TODAY` : `${soonest.name} due in ${soonest.days}d`,
      tone: soonest.days <= 3 ? 'warn' : 'neutral',
    };
  },
  'money/wishlist': () => {
    const items = read<{ price: number; bought: boolean }[]>('os.money.wishlist', []);
    const open = items.filter((i) => !i.bought);
    if (open.length === 0) return null;
    return {
      text: `${open.length} wanted · ${gbp(open.reduce((s, i) => s + i.price, 0))}`,
      tone: 'neutral',
    };
  },
};

/**
 * Roll a node's subtree up into at most `max` signals: the node's own
 * signal first, then its children's, depth-first in tree order.
 */
export function collectSignals(node: OsNode, path: string, max: number): Signal[] {
  const out: Signal[] = [];
  const own = leafSignals[path]?.();
  if (own) out.push(own);
  if (node.children) {
    for (const child of node.children) {
      if (out.length >= max) break;
      const childPath = path ? `${path}/${child.slug}` : child.slug;
      out.push(...collectSignals(child, childPath, max - out.length));
    }
  }
  return out.slice(0, max);
}

export const toneCls: Record<Tone, string> = {
  good: 'text-green-400',
  warn: 'text-yellow-400',
  bad: 'text-red-400',
  neutral: 'text-gray-400',
};
