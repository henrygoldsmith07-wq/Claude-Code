'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, today } from '@/lib/os/storage';

/** date -> steps */
type StepLog = Record<string, number>;

export default function StepsPage() {
  const [log, setLog] = useStoredState<StepLog>('os.health.steps', {});
  const [target, setTarget] = useStoredState<number>('os.health.steps.target', 8000);
  const [date, setDate] = useState(today());
  const [steps, setSteps] = useState('');

  const save = () => {
    const n = parseInt(steps);
    if (!date || isNaN(n) || n < 0) return;
    setLog({ ...log, [date]: n });
    setSteps('');
  };

  const days = Object.entries(log).sort((a, b) => b[0].localeCompare(a[0]));
  const recent = days.slice(0, 7);
  const avg = recent.length ? Math.round(recent.reduce((s, [, n]) => s + n, 0) / recent.length) : null;
  const todaySteps = log[today()];

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Health OS', href: '/os/health' }, { name: 'Steps' }]}
      icon="🚶" title="Steps" tagline="Copy the number off your phone once a day.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3 items-center">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={inputCls} type="number" min="0" placeholder="Steps"
            value={steps} onChange={(e) => setSteps(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button className={btnCls} onClick={save}>Save</button>
          <label className="text-xs text-gray-500 inline-flex items-center gap-2 ml-auto">
            Daily target
            <input className={`${inputCls} w-24`} type="number" min="0" step="500" value={target}
              onChange={(e) => setTarget(Math.max(0, parseInt(e.target.value) || 0))} />
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Today</p>
          <p className={`text-4xl font-bold mt-2 ${todaySteps !== undefined && todaySteps >= target ? 'text-green-400' : 'text-white'}`}>
            {todaySteps !== undefined ? todaySteps.toLocaleString() : '—'}
          </p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">7-day average</p>
          <p className="text-4xl font-bold text-white mt-2">{avg !== null ? avg.toLocaleString() : '—'}</p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">History</h2>
        {days.length === 0 && <p className="text-sm text-gray-600">Nothing logged yet.</p>}
        <ul className="divide-y divide-gray-900">
          {days.map(([d, n]) => (
            <li key={d} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-300">{d}</span>
              <span className="flex items-center gap-3">
                <span className={n >= target ? 'text-green-400' : 'text-gray-400'}>{n.toLocaleString()}</span>
                <button className={dangerBtnCls}
                  onClick={() => {
                    const nextLog = { ...log };
                    delete nextLog[d];
                    setLog(nextLog);
                  }}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
