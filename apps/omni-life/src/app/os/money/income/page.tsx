'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Income {
  id: string;
  date: string;
  app: string;
  amount: number;
  source: string;
}

const apps = [
  'Omni-Life', 'WJEC Study Hub', 'Emotion Tracker', 'Subscription Tracker',
  'Daily Debate', 'World News', 'Podcast Repurposer', 'RTK', 'Other',
];

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function AppIncomePage() {
  const [incomes, setIncomes] = useStoredState<Income[]>('os.money.income', []);
  const [date, setDate] = useState(today());
  const [app, setApp] = useState(apps[0]);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');

  const addIncome = () => {
    const value = parseFloat(amount);
    if (!date || isNaN(value) || value <= 0) return;
    setIncomes([{ id: uid(), date, app, amount: value, source: source.trim() }, ...incomes]);
    setAmount('');
    setSource('');
  };

  const thisMonth = today().slice(0, 7);
  const totalAll = incomes.reduce((s, i) => s + i.amount, 0);
  const totalMonth = incomes.filter((i) => i.date.startsWith(thisMonth)).reduce((s, i) => s + i.amount, 0);
  const perApp = apps
    .map((name) => ({
      name,
      total: incomes.filter((i) => i.app === name).reduce((s, i) => s + i.amount, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Money OS', href: '/os/money' },
        { name: 'App Income' },
      ]}
      icon="📊"
      title="App Income"
      tagline="First dollars per app — the signal that picks the winners."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Record income</h2>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className={inputCls} value={app} onChange={(e) => setApp(e.target.value)}>
            {apps.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="Amount (£)"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Source (Stripe, ads, one-off…)"
            value={source} onChange={(e) => setSource(e.target.value)} />
          <button className={btnCls} onClick={addIncome}>Add</button>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Omni-Life&apos;s Stripe webhook can feed this automatically once an app starts charging.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">This month</p>
          <p className="text-4xl font-bold text-white mt-2">{gbp(totalMonth)}</p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">All time</p>
          <p className="text-4xl font-bold text-white mt-2">{gbp(totalAll)}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panelCls}>
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Leaderboard</h2>
          {perApp.length === 0 && (
            <p className="text-sm text-gray-600">No income yet — the first entry crowns the first winner.</p>
          )}
          <ul className="space-y-2">
            {perApp.map((row, i) => (
              <li key={row.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{i + 1}. {row.name}</span>
                <span className="text-green-400 font-semibold">{gbp(row.total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={panelCls}>
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Recent entries</h2>
          {incomes.length === 0 && <p className="text-sm text-gray-600">Nothing recorded yet.</p>}
          <ul className="divide-y divide-gray-900">
            {incomes.slice(0, 10).map((inc) => (
              <li key={inc.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="text-gray-200">{inc.app}</span>
                  <span className="text-gray-600 text-xs ml-2">
                    {inc.date}{inc.source && ` · ${inc.source}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">{gbp(inc.amount)}</span>
                  <button className={dangerBtnCls}
                    onClick={() => setIncomes(incomes.filter((i) => i.id !== inc.id))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </OsShell>
  );
}
