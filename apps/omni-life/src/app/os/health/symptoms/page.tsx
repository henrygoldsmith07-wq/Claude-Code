'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Symptom {
  id: string;
  date: string;
  what: string;
  severity: number; // 1-5
}

function sevColor(s: number): string {
  if (s >= 4) return 'text-red-400';
  if (s >= 3) return 'text-yellow-400';
  return 'text-gray-400';
}

export default function SymptomsPage() {
  const [entries, setEntries] = useStoredState<Symptom[]>('os.health.symptoms', []);
  const [what, setWhat] = useState('');
  const [severity, setSeverity] = useState(2);

  const add = () => {
    if (!what.trim()) return;
    setEntries([{ id: uid(), date: today(), what: what.trim(), severity }, ...entries]);
    setWhat('');
  };

  const counts = new Map<string, number>();
  entries.forEach((e) => counts.set(e.what.toLowerCase(), (counts.get(e.what.toLowerCase()) ?? 0) + 1));
  const repeats = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Health OS', href: '/os/health' }, { name: 'Symptoms Journal' }]}
      icon="🤒" title="Symptoms Journal" tagline="What hurt, when, how much — worth gold at a GP appointment.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="Symptom (e.g. headache after screens)"
            value={what} onChange={(e) => setWhat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className={inputCls} value={severity} onChange={(e) => setSeverity(+e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Severity {n}</option>)}
          </select>
          <button className={btnCls} onClick={add}>Log</button>
        </div>
        {repeats.length > 0 && (
          <p className="text-xs text-yellow-400 mt-3">
            Recurring: {repeats.map(([w, n]) => `${w} ×${n}`).join(' · ')} — patterns like these are worth mentioning to a doctor.
          </p>
        )}
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">History</h2>
        {entries.length === 0 && <p className="text-sm text-gray-600">Nothing logged. Long may it continue.</p>}
        <ul className="divide-y divide-gray-900">
          {entries.map((e) => (
            <li key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">{e.what}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className={sevColor(e.severity)}>{'●'.repeat(e.severity)}{'○'.repeat(5 - e.severity)}</span>
                <span className="text-gray-600 text-xs">{e.date}</span>
                <button className={dangerBtnCls}
                  onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
