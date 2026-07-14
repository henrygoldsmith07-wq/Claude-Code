'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Severity = 'low' | 'med' | 'high';

interface Bug {
  id: string;
  app: string;
  desc: string;
  severity: Severity;
  fixed: boolean;
}

const sevOrder: Record<Severity, number> = { high: 0, med: 1, low: 2 };
const sevCls: Record<Severity, string> = {
  high: 'text-red-400', med: 'text-yellow-400', low: 'text-gray-400',
};

export default function BugTrackerPage() {
  const [bugs, setBugs] = useStoredState<Bug[]>('os.builder.bugs', []);
  const [app, setApp] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<Severity>('med');

  const add = () => {
    if (!desc.trim()) return;
    setBugs([{ id: uid(), app: app.trim() || 'General', desc: desc.trim(), severity, fixed: false }, ...bugs]);
    setDesc('');
  };

  const open = bugs.filter((b) => !b.fixed).sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const fixed = bugs.filter((b) => b.fixed);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Builder OS', href: '/os/builder' }, { name: 'Bug Tracker' }]}
      icon="🐛" title="Bug Tracker" tagline="Open bugs across the portfolio, worst first.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="App" value={app} onChange={(e) => setApp(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="What's broken?"
            value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            <option value="high">🔴 High</option>
            <option value="med">🟡 Medium</option>
            <option value="low">⚪ Low</option>
          </select>
          <button className={btnCls} onClick={add}>File bug</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-red-400 mb-4">Open · {open.length}</h2>
        {open.length === 0 && <p className="text-sm text-gray-600">Zero known bugs. Suspicious, but enjoy it.</p>}
        <ul className="space-y-2">
          {open.map((bug) => (
            <li key={bug.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                <span className={`text-xs uppercase tracking-widest mr-2 ${sevCls[bug.severity]}`}>{bug.severity}</span>
                {bug.desc}
                <span className="text-gray-600 text-xs ml-2">{bug.app}</span>
              </span>
              <span className="flex items-center gap-2">
                <button className={btnCls}
                  onClick={() => setBugs(bugs.map((b) => b.id === bug.id ? { ...b, fixed: true } : b))}>
                  Fixed
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setBugs(bugs.filter((b) => b.id !== bug.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-green-400 mb-4">Fixed · {fixed.length}</h2>
        <ul className="divide-y divide-gray-900">
          {fixed.slice(0, 15).map((bug) => (
            <li key={bug.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 line-through">{bug.desc}</span>
              <button className={dangerBtnCls}
                onClick={() => setBugs(bugs.filter((b) => b.id !== bug.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
