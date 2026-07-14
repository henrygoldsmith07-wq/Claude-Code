'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Goal {
  id: string;
  name: string;
  target: number;
  done: number;
}

export default function StudyGoalsPage() {
  const [goals, setGoals] = useStoredState<Goal[]>('os.study.goals', []);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');

  const add = () => {
    const t = parseInt(target);
    if (!name.trim() || isNaN(t) || t <= 0) return;
    setGoals([...goals, { id: uid(), name: name.trim(), target: t, done: 0 }]);
    setName('');
    setTarget('');
  };

  const bump = (goal: Goal, delta: number) =>
    setGoals(goals.map((g) => g.id === goal.id ? { ...g, done: Math.max(0, g.done + delta) } : g));

  const hit = goals.filter((g) => g.done >= g.target).length;

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Study OS', href: '/os/study' }, { name: 'Study Goals' }]}
      icon="🎯" title="Study Goals" tagline='Countable weekly targets — "10 past papers", not "revise more".'>
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder='Goal (e.g. "Past papers this week")'
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} type="number" min="1" placeholder="Target"
            value={target} onChange={(e) => setTarget(e.target.value)} />
          <button className={btnCls} onClick={add}>Set goal</button>
          {goals.length > 0 && (
            <span className="ml-auto text-sm text-gray-500 self-center">
              <span className="text-green-400 font-semibold">{hit}</span>/{goals.length} hit ·{' '}
              <button className="underline underline-offset-4 hover:text-gray-300"
                onClick={() => setGoals(goals.map((g) => ({ ...g, done: 0 })))}>
                reset week
              </button>
            </span>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {goals.length === 0 && (
          <p className={`${panelCls} text-sm text-gray-600`}>No goals set — a target you can count is a target you can hit.</p>
        )}
        {goals.map((goal) => {
          const pct = Math.min(100, (goal.done / goal.target) * 100);
          const hitIt = goal.done >= goal.target;
          return (
            <div key={goal.id} className={panelCls}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">{hitIt && '✅ '}{goal.name}</h3>
                <button className={dangerBtnCls}
                  onClick={() => setGoals(goals.filter((g) => g.id !== goal.id))}>remove</button>
              </div>
              <p className="text-sm text-gray-500 mb-2">{goal.done} of {goal.target}</p>
              <div className="h-2 bg-gray-900 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${hitIt ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-2">
                <button className={btnCls} onClick={() => bump(goal, 1)}>+1</button>
                <button className={`${btnCls} !text-gray-400 !border-gray-700 !bg-gray-900`}
                  onClick={() => bump(goal, -1)}>−1</button>
              </div>
            </div>
          );
        })}
      </section>
    </OsShell>
  );
}
