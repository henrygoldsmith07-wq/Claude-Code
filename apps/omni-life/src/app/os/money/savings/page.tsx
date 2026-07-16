'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
}

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function SavingsGoalsPage() {
  const [goals, setGoals] = useStoredState<Goal[]>('os.money.savings', []);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const addGoal = () => {
    const t = parseFloat(target);
    if (!name.trim() || isNaN(t) || t <= 0) return;
    setGoals([...goals, { id: uid(), name: name.trim(), target: t, saved: 0 }]);
    setName('');
    setTarget('');
  };

  const contribute = (goal: Goal) => {
    const amount = parseFloat(amounts[goal.id] ?? '');
    if (isNaN(amount) || amount === 0) return;
    setGoals(goals.map((g) =>
      g.id === goal.id ? { ...g, saved: Math.max(0, g.saved + amount) } : g
    ));
    setAmounts({ ...amounts, [goal.id]: '' });
  };

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Money OS', href: '/os/money' },
        { name: 'Savings Goals' },
      ]}
      icon="💰"
      title="Savings Goals"
      tagline="Name the goal, feed it, watch the bar fill."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Goal (e.g. New laptop)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} type="number" step="1" min="1" placeholder="Target £"
            value={target} onChange={(e) => setTarget(e.target.value)} />
          <button className={btnCls} onClick={addGoal}>Add goal</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            Total saved <span className="text-green-400 font-semibold">{gbp(totalSaved)}</span>
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {goals.length === 0 && (
          <p className={`${panelCls} text-sm text-gray-600`}>No goals yet — the first one makes saving concrete.</p>
        )}
        {goals.map((goal) => {
          const pct = Math.min(100, (goal.saved / goal.target) * 100);
          const done = goal.saved >= goal.target;
          return (
            <div key={goal.id} className={panelCls}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">{done && '🎉 '}{goal.name}</h3>
                <button className={dangerBtnCls}
                  onClick={() => setGoals(goals.filter((g) => g.id !== goal.id))}>remove</button>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                <span className={done ? 'text-green-400' : 'text-gray-300'}>{gbp(goal.saved)}</span> of {gbp(goal.target)}
                <span className="text-gray-600"> · {pct.toFixed(0)}%</span>
              </p>
              <div className="h-2 bg-gray-900 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-2">
                <input className={`${inputCls} w-32`} type="number" step="1" placeholder="± £"
                  value={amounts[goal.id] ?? ''}
                  onChange={(e) => setAmounts({ ...amounts, [goal.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && contribute(goal)} />
                <button className={btnCls} onClick={() => contribute(goal)}>Add</button>
              </div>
            </div>
          );
        })}
      </section>
    </OsShell>
  );
}
