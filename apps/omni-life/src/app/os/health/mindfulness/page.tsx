'use client';

import React from 'react';
import OsShell, { panelCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Session {
  id: string;
  date: string;
  minutes: number;
}

const presets = [2, 5, 10, 20];

export default function MindfulnessPage() {
  const [sessions, setSessions] = useStoredState<Session[]>('os.health.mindfulness', []);

  const add = (minutes: number) =>
    setSessions([{ id: uid(), date: today(), minutes }, ...sessions]);

  const todayMins = sessions.filter((s) => s.date === today()).reduce((s, x) => s + x.minutes, 0);
  const daysPractised = new Set(sessions.map((s) => s.date)).size;

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Health OS', href: '/os/health' }, { name: 'Mindfulness' }]}
      icon="🧘" title="Mindfulness" tagline="Two minutes counts. Log it when you've done it.">
      <section className={`${panelCls} text-center`}>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Log a session</p>
        <div className="flex flex-wrap justify-center gap-3">
          {presets.map((m) => (
            <button key={m} className={btnCls} onClick={() => add(m)}>+{m} min</button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Today</p>
          <p className={`text-4xl font-bold mt-2 ${todayMins > 0 ? 'text-green-400' : 'text-white'}`}>{todayMins} min</p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Days practised</p>
          <p className="text-4xl font-bold text-white mt-2">{daysPractised}</p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Recent</h2>
        {sessions.length === 0 && <p className="text-sm text-gray-600">No sessions yet — start with two minutes of breathing.</p>}
        <ul className="divide-y divide-gray-900">
          {sessions.slice(0, 14).map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-300">{s.date}</span>
              <span className="flex items-center gap-3">
                <span className="text-gray-400">{s.minutes} min</span>
                <button className={dangerBtnCls}
                  onClick={() => setSessions(sessions.filter((x) => x.id !== s.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
