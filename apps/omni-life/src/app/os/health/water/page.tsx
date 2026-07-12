'use client';

import React from 'react';
import OsShell, { panelCls, inputCls } from '@/components/os/shell';
import { useStoredState, today } from '@/lib/os/storage';

/** date -> glasses drunk */
type WaterLog = Record<string, number>;

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today() + 'T00:00:00');
    d.setDate(d.getDate() - (n - 1 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

export default function WaterTrackerPage() {
  const [log, setLog] = useStoredState<WaterLog>('os.health.water', {});
  const [target, setTarget] = useStoredState<number>('os.health.water.target', 8);

  const t = today();
  const count = log[t] ?? 0;
  const week = lastNDays(7);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Health OS', href: '/os/health' },
        { name: 'Water Tracker' },
      ]}
      icon="💧"
      title="Water Tracker"
      tagline="Tap a glass every time you drink one."
    >
      <section className={`${panelCls} text-center`}>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Today</p>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {Array.from({ length: Math.max(target, count) }, (_, i) => (
            <button key={i}
              onClick={() => setLog({ ...log, [t]: i + 1 === count ? i : i + 1 })}
              className={`w-11 h-14 rounded-xl border text-2xl transition-colors ${
                i < count
                  ? 'bg-blue-500/20 border-blue-500/40'
                  : 'bg-gray-900 border-gray-800 opacity-40 hover:opacity-80'
              }`}
              aria-label={`Glass ${i + 1}`}>
              💧
            </button>
          ))}
        </div>
        <p className={`text-3xl font-bold ${count >= target ? 'text-green-400' : 'text-white'}`}>
          {count} / {target}
        </p>
        <label className="text-xs text-gray-500 mt-4 inline-flex items-center gap-2">
          Daily target
          <input className={`${inputCls} w-20`} type="number" min="1" max="20" value={target}
            onChange={(e) => setTarget(Math.max(1, parseInt(e.target.value) || 1))} />
        </label>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Last 7 days</h2>
        <div className="flex items-end justify-between gap-2 h-28">
          {week.map((d) => {
            const glasses = log[d] ?? 0;
            const met = glasses >= target;
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{glasses}</span>
                <div className={`w-full rounded-t-md ${met ? 'bg-green-500' : 'bg-blue-500/60'}`}
                  style={{ height: `${Math.min(100, (glasses / target) * 100)}%`, minHeight: glasses > 0 ? 4 : 0 }} />
                <span className="text-[10px] text-gray-600">
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </OsShell>
  );
}
