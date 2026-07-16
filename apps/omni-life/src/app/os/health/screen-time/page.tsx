'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, today } from '@/lib/os/storage';

/** date -> hours on screens (outside work/study) */
type ScreenLog = Record<string, number>;

export default function ScreenTimePage() {
  const [log, setLog] = useStoredState<ScreenLog>('os.health.screentime', {});
  const [target, setTarget] = useStoredState<number>('os.health.screentime.target', 3);
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState('');

  const save = () => {
    const h = parseFloat(hours);
    if (!date || isNaN(h) || h < 0) return;
    setLog({ ...log, [date]: h });
    setHours('');
  };

  const days = Object.entries(log).sort((a, b) => b[0].localeCompare(a[0]));
  const recent = days.slice(0, 7);
  const avg = recent.length
    ? recent.reduce((s, [, h]) => s + h, 0) / recent.length
    : null;

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Health OS', href: '/os/health' },
        { name: 'Screen Time' },
      ]}
      icon="📵"
      title="Screen Time"
      tagline="Track the doomscroll hours — what gets measured gets shrunk."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3 items-center">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={inputCls} type="number" step="0.5" min="0" max="24" placeholder="Hours"
            value={hours} onChange={(e) => setHours(e.target.value)} />
          <button className={btnCls} onClick={save}>Save</button>
          <label className="text-xs text-gray-500 inline-flex items-center gap-2 ml-auto">
            Daily ceiling
            <input className={`${inputCls} w-20`} type="number" step="0.5" min="0" value={target}
              onChange={(e) => setTarget(Math.max(0, parseFloat(e.target.value) || 0))} />
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">7-day average</p>
          <p className={`text-4xl font-bold mt-2 ${avg !== null && avg > target ? 'text-red-400' : 'text-white'}`}>
            {avg !== null ? `${avg.toFixed(1)}h` : '—'}
          </p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Today</p>
          <p className={`text-4xl font-bold mt-2 ${(log[today()] ?? 0) > target ? 'text-red-400' : 'text-white'}`}>
            {log[today()] !== undefined ? `${log[today()]}h` : '—'}
          </p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">History</h2>
        {days.length === 0 && <p className="text-sm text-gray-600">Nothing logged yet.</p>}
        <ul className="divide-y divide-gray-900">
          {days.map(([d, h]) => (
            <li key={d} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-300">{d}</span>
              <span className="flex items-center gap-3">
                <span className={h > target ? 'text-red-400' : 'text-green-400'}>{h}h</span>
                <button className={dangerBtnCls}
                  onClick={() => {
                    const next = { ...log };
                    delete next[d];
                    setLog(next);
                  }}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
