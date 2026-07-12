'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Habit {
  id: string;
  name: string;
  /** Dates (YYYY-MM-DD) the habit was done */
  history: string[];
}

function dateOffset(offset: number): string {
  const d = new Date(today() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive days done, counting back from today (or yesterday if today is unticked). */
function streak(habit: Habit): number {
  const done = new Set(habit.history);
  let start = done.has(today()) ? 0 : -1;
  let count = 0;
  while (done.has(dateOffset(start - count))) count++;
  return count;
}

export default function HabitsPage() {
  const [habits, setHabits] = useStoredState<Habit[]>('os.health.habits', []);
  const [name, setName] = useState('');

  const addHabit = () => {
    if (!name.trim()) return;
    setHabits([...habits, { id: uid(), name: name.trim(), history: [] }]);
    setName('');
  };

  const toggleToday = (habit: Habit) => {
    const t = today();
    const history = habit.history.includes(t)
      ? habit.history.filter((d) => d !== t)
      : [...habit.history, t];
    setHabits(habits.map((h) => (h.id === habit.id ? { ...h, history } : h)));
  };

  const week = Array.from({ length: 7 }, (_, i) => dateOffset(i - 6));

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Health OS', href: '/os/health' },
        { name: 'Habits' },
      ]}
      icon="🔁"
      title="Habits"
      tagline="Daily non-negotiables, streaks, and a week at a glance."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="New habit (e.g. 30 min revision before breakfast)"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHabit()} />
          <button className={btnCls} onClick={addHabit}>Add habit</button>
        </div>
      </section>

      <section className={panelCls}>
        {habits.length === 0 && (
          <p className="text-sm text-gray-600">No habits yet — add the first non-negotiable above.</p>
        )}
        <ul className="space-y-4">
          {habits.map((habit) => {
            const doneToday = habit.history.includes(today());
            return (
              <li key={habit.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(habit)}
                    className={`w-9 h-9 rounded-full border text-lg transition-colors ${
                      doneToday
                        ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : 'bg-gray-900 border-gray-700 text-gray-600 hover:border-green-500/40'
                    }`}
                    aria-label={`Mark ${habit.name} done today`}
                  >
                    ✓
                  </button>
                  <div>
                    <p className="text-white font-medium">{habit.name}</p>
                    <p className="text-xs text-gray-600">
                      {streak(habit)} day streak · {habit.history.length} total
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {week.map((d) => (
                      <span key={d} title={d}
                        className={`w-2.5 h-2.5 rounded-full ${
                          habit.history.includes(d) ? 'bg-green-500' : 'bg-gray-800'
                        }`} />
                    ))}
                  </div>
                  <button className={dangerBtnCls}
                    onClick={() => setHabits(habits.filter((h) => h.id !== habit.id))}>
                    remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </OsShell>
  );
}
