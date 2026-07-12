'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface Meal {
  id: string;
  date: string;
  kind: MealKind;
  what: string;
}

const kinds: { id: MealKind; label: string }[] = [
  { id: 'breakfast', label: '🌅 Breakfast' },
  { id: 'lunch', label: '☀️ Lunch' },
  { id: 'dinner', label: '🌙 Dinner' },
  { id: 'snack', label: '🍎 Snack' },
];

export default function MealLogPage() {
  const [meals, setMeals] = useStoredState<Meal[]>('os.health.meals', []);
  const [kind, setKind] = useState<MealKind>('breakfast');
  const [what, setWhat] = useState('');

  const addMeal = () => {
    if (!what.trim()) return;
    setMeals([{ id: uid(), date: today(), kind, what: what.trim() }, ...meals]);
    setWhat('');
  };

  const t = today();
  const todays = meals.filter((m) => m.date === t);
  const history = meals.filter((m) => m.date !== t);
  const kindLabel = (k: MealKind) => kinds.find((x) => x.id === k)!.label;

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Health OS', href: '/os/health' },
        { name: 'Meal Log' },
      ]}
      icon="🍽️"
      title="Meal Log"
      tagline="One line per meal — awareness beats calorie maths."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as MealKind)}>
            {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="What did you eat?"
            value={what} onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMeal()} />
          <button className={btnCls} onClick={addMeal}>Log</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Today · {todays.length} meal{todays.length === 1 ? '' : 's'}</h2>
        {todays.length === 0 && <p className="text-sm text-gray-600">Nothing logged today yet.</p>}
        <ul className="space-y-2">
          {todays.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">{kindLabel(m.kind)} — {m.what}</span>
              <button className={dangerBtnCls}
                onClick={() => setMeals(meals.filter((x) => x.id !== m.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Earlier</h2>
        {history.length === 0 && <p className="text-sm text-gray-600">No history yet.</p>}
        <ul className="divide-y divide-gray-900">
          {history.slice(0, 20).map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-300">{kindLabel(m.kind)} — {m.what}</span>
              <span className="text-gray-600 text-xs">{m.date}</span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
