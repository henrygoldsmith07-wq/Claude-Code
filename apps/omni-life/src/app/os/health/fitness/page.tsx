'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface DayLog {
  id: string;
  date: string;
  sleepHours: number;
  workout: string;
}

export default function FitnessPage() {
  const [logs, setLogs] = useStoredState<DayLog[]>('os.health.fitness', []);
  const [date, setDate] = useState(today());
  const [sleep, setSleep] = useState('');
  const [workout, setWorkout] = useState('');

  const addLog = () => {
    const hours = parseFloat(sleep);
    if (!date || isNaN(hours)) return;
    setLogs([
      { id: uid(), date, sleepHours: hours, workout: workout.trim() },
      ...logs.filter((l) => l.date !== date),
    ]);
    setSleep('');
    setWorkout('');
  };

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 7);
  const avgSleep = recent.length
    ? (recent.reduce((sum, l) => sum + l.sleepHours, 0) / recent.length).toFixed(1)
    : null;
  const workoutsThisWeek = recent.filter((l) => l.workout).length;

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Health OS', href: '/os/health' },
        { name: 'Fitness & Sleep' },
      ]}
      icon="🏃"
      title="Fitness & Sleep"
      tagline="One line a day. Sleep hours and whatever moved you."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Log a day</h2>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={inputCls} type="number" step="0.5" min="0" max="24" placeholder="Sleep (hours)"
            value={sleep} onChange={(e) => setSleep(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Workout (optional — gym, run, football…)"
            value={workout} onChange={(e) => setWorkout(e.target.value)} />
          <button className={btnCls} onClick={addLog}>Save</button>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Omni-Life already has Google Fit and Hevy service hooks — wiring those in replaces this manual log.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Avg sleep, last {recent.length || 0} logged</p>
          <p className="text-4xl font-bold text-white mt-2">{avgSleep ? `${avgSleep}h` : '—'}</p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Workouts in those days</p>
          <p className="text-4xl font-bold text-white mt-2">{recent.length ? workoutsThisWeek : '—'}</p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">History</h2>
        {sorted.length === 0 && <p className="text-sm text-gray-600">Nothing logged yet.</p>}
        <ul className="divide-y divide-gray-900">
          {sorted.map((log) => (
            <li key={log.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-medium">{log.date}</p>
                <p className="text-xs text-gray-600">
                  {log.sleepHours}h sleep{log.workout && ` · ${log.workout}`}
                </p>
              </div>
              <button className={dangerBtnCls}
                onClick={() => setLogs(logs.filter((l) => l.id !== log.id))}>
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
