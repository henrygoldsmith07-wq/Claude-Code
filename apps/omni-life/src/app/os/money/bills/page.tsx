'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // 1-31
}

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

/** Days from today until the bill's next due date. */
function daysToDue(dueDay: number): number {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (due.getDate() !== dueDay) due.setDate(0); // clamp short months
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    due.setMonth(due.getMonth() + 1, dueDay);
    if (due.getDate() !== dueDay) due.setDate(0);
  }
  return Math.round((due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
}

export default function BillsPage() {
  const [bills, setBills] = useStoredState<Bill[]>('os.money.bills', []);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');

  const add = () => {
    const a = parseFloat(amount);
    const d = parseInt(dueDay);
    if (!name.trim() || isNaN(a) || isNaN(d) || d < 1 || d > 31) return;
    setBills([...bills, { id: uid(), name: name.trim(), amount: a, dueDay: d }]);
    setName(''); setAmount(''); setDueDay('');
  };

  const sorted = [...bills].sort((a, b) => daysToDue(a.dueDay) - daysToDue(b.dueDay));
  const monthlyTotal = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Money OS', href: '/os/money' }, { name: 'Bills Calendar' }]}
      icon="📄" title="Bills Calendar" tagline="What's due, when, and how long you've got.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Bill (e.g. phone, Spotify)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="£ / month"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={inputCls} type="number" min="1" max="31" placeholder="Due day (1-31)"
            value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          <button className={btnCls} onClick={add}>Add bill</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            Monthly total <span className="text-white font-semibold">{gbp(monthlyTotal)}</span>
          </span>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Next due</h2>
        {sorted.length === 0 && <p className="text-sm text-gray-600">No recurring bills tracked.</p>}
        <ul className="space-y-2">
          {sorted.map((bill) => {
            const days = daysToDue(bill.dueDay);
            return (
              <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-200">
                  {bill.name}
                  <span className="text-gray-600 text-xs ml-2">day {bill.dueDay} · {gbp(bill.amount)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`font-semibold ${days <= 3 ? 'text-red-400' : days <= 7 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {days === 0 ? 'today' : `${days}d`}
                  </span>
                  <button className={dangerBtnCls}
                    onClick={() => setBills(bills.filter((b) => b.id !== bill.id))}>✕</button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </OsShell>
  );
}
