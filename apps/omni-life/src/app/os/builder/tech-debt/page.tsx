'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Debt {
  id: string;
  app: string;
  desc: string;
  pain: 1 | 2 | 3;
  cleared: boolean;
}

const painLabel: Record<number, string> = { 3: '🔥🔥🔥', 2: '🔥🔥', 1: '🔥' };

export default function TechDebtPage() {
  const [debts, setDebts] = useStoredState<Debt[]>('os.builder.debt', []);
  const [app, setApp] = useState('');
  const [desc, setDesc] = useState('');
  const [pain, setPain] = useState<1 | 2 | 3>(2);

  const add = () => {
    if (!desc.trim()) return;
    setDebts([{ id: uid(), app: app.trim() || 'General', desc: desc.trim(), pain, cleared: false }, ...debts]);
    setDesc('');
  };

  const open = debts.filter((d) => !d.cleared).sort((a, b) => b.pain - a.pain);
  const cleared = debts.filter((d) => d.cleared);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Builder OS', href: '/os/builder' }, { name: 'Tech Debt' }]}
      icon="🔩" title="Tech Debt" tagline="Every deliberate shortcut, written down while it's cheap to remember.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="App" value={app} onChange={(e) => setApp(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="The shortcut taken (e.g. localStorage instead of Supabase)"
            value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className={inputCls} value={pain} onChange={(e) => setPain(+e.target.value as 1 | 2 | 3)}>
            <option value={3}>🔥🔥🔥 Hurting now</option>
            <option value={2}>🔥🔥 Will hurt soon</option>
            <option value={1}>🔥 Fine for ages</option>
          </select>
          <button className={btnCls} onClick={add}>Record debt</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-yellow-400 mb-4">Owed · {open.length}</h2>
        {open.length === 0 && <p className="text-sm text-gray-600">Debt-free (or in denial).</p>}
        <ul className="space-y-2">
          {open.map((debt) => (
            <li key={debt.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                <span className="mr-2">{painLabel[debt.pain]}</span>
                {debt.desc}
                <span className="text-gray-600 text-xs ml-2">{debt.app}</span>
              </span>
              <span className="flex items-center gap-2">
                <button className={btnCls}
                  onClick={() => setDebts(debts.map((d) => d.id === debt.id ? { ...d, cleared: true } : d))}>
                  Paid off
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setDebts(debts.filter((d) => d.id !== debt.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-green-400 mb-4">Paid off · {cleared.length}</h2>
        <ul className="divide-y divide-gray-900">
          {cleared.slice(0, 15).map((debt) => (
            <li key={debt.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 line-through">{debt.desc}</span>
              <button className={dangerBtnCls}
                onClick={() => setDebts(debts.filter((d) => d.id !== debt.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
