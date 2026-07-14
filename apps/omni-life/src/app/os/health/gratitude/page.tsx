'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Entry {
  id: string;
  date: string;
  text: string;
}

export default function GratitudePage() {
  const [entries, setEntries] = useStoredState<Entry[]>('os.health.gratitude', []);
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    setEntries([{ id: uid(), date: today(), text: text.trim() }, ...entries]);
    setText('');
  };

  const todays = entries.filter((e) => e.date === today());
  const past = entries.filter((e) => e.date !== today());
  const byDate = past.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.date] = acc[e.date] ?? []).push(e);
    return acc;
  }, {});

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Health OS', href: '/os/health' }, { name: 'Gratitude' }]}
      icon="🌅" title="Gratitude" tagline="Three good things a day — the cheapest mood intervention with evidence behind it.">
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">
          Today · {todays.length}/3
          {todays.length >= 3 && <span className="text-green-400 ml-2">✓ done</span>}
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input className={`${inputCls} flex-1 min-w-[240px]`} placeholder="Something good from today"
            value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className={btnCls} onClick={add}>Add</button>
        </div>
        <ul className="space-y-2">
          {todays.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">🌅 {e.text}</span>
              <button className={dangerBtnCls}
                onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Earlier days</h2>
        {Object.keys(byDate).length === 0 && <p className="text-sm text-gray-600">No history yet.</p>}
        <div className="space-y-4">
          {Object.entries(byDate).slice(0, 10).map(([date, list]) => (
            <div key={date}>
              <p className="text-xs text-gray-600 mb-1">{date}</p>
              <ul className="space-y-1">
                {list.map((e) => (
                  <li key={e.id} className="text-sm text-gray-400">· {e.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </OsShell>
  );
}
