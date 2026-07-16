'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Category {
  id: string;
  name: string;
  planned: number;
}

interface Spend {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
}

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function BudgetPage() {
  const [categories, setCategories] = useStoredState<Category[]>('os.money.budget.categories', []);
  const [spends, setSpends] = useStoredState<Spend[]>('os.money.budget.spends', []);
  const [catName, setCatName] = useState('');
  const [catPlanned, setCatPlanned] = useState('');
  const [spendCat, setSpendCat] = useState('');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendNote, setSpendNote] = useState('');

  const addCategory = () => {
    const planned = parseFloat(catPlanned);
    if (!catName.trim() || isNaN(planned)) return;
    setCategories([...categories, { id: uid(), name: catName.trim(), planned }]);
    setCatName('');
    setCatPlanned('');
  };

  const addSpend = () => {
    const amount = parseFloat(spendAmount);
    const category = spendCat || categories[0]?.name;
    if (!category || isNaN(amount) || amount <= 0) return;
    setSpends([{ id: uid(), date: today(), category, amount, note: spendNote.trim() }, ...spends]);
    setSpendAmount('');
    setSpendNote('');
  };

  const thisMonth = today().slice(0, 7);
  const monthSpends = spends.filter((s) => s.date.startsWith(thisMonth));
  const spentIn = (name: string) =>
    monthSpends.filter((s) => s.category === name).reduce((sum, s) => sum + s.amount, 0);
  const totalPlanned = categories.reduce((s, c) => s + c.planned, 0);
  const totalSpent = monthSpends.reduce((s, x) => s + x.amount, 0);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Money OS', href: '/os/money' },
        { name: 'Budget' },
      ]}
      icon="🧾"
      title="Budget"
      tagline={`Plan vs actual — ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`}
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Planned / month</p>
          <p className="text-4xl font-bold text-white mt-2">{gbp(totalPlanned)}</p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Spent this month</p>
          <p className={`text-4xl font-bold mt-2 ${totalSpent > totalPlanned && totalPlanned > 0 ? 'text-red-400' : 'text-white'}`}>
            {gbp(totalSpent)}
          </p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Categories</h2>
        <div className="flex flex-wrap gap-3 mb-5">
          <input className={inputCls} placeholder="Category (e.g. Food, Subs, Going out)"
            value={catName} onChange={(e) => setCatName(e.target.value)} />
          <input className={inputCls} type="number" step="1" min="0" placeholder="Planned £/month"
            value={catPlanned} onChange={(e) => setCatPlanned(e.target.value)} />
          <button className={btnCls} onClick={addCategory}>Add category</button>
        </div>
        {categories.length === 0 && (
          <p className="text-sm text-gray-600">No categories yet — the budget starts when the first one exists.</p>
        )}
        <ul className="space-y-3">
          {categories.map((cat) => {
            const spent = spentIn(cat.name);
            const pct = cat.planned > 0 ? Math.min(100, (spent / cat.planned) * 100) : 100;
            const over = spent > cat.planned;
            return (
              <li key={cat.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-200">{cat.name}</span>
                  <span className="flex items-center gap-3">
                    <span className={over ? 'text-red-400' : 'text-gray-400'}>
                      {gbp(spent)} / {gbp(cat.planned)}
                    </span>
                    <button className={dangerBtnCls}
                      onClick={() => setCategories(categories.filter((c) => c.id !== cat.id))}>
                      ✕
                    </button>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Log spending</h2>
        <div className="flex flex-wrap gap-3 mb-5">
          <select className={inputCls} value={spendCat} onChange={(e) => setSpendCat(e.target.value)}>
            {categories.length === 0 && <option value="">Add a category first</option>}
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="Amount (£)"
            value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Note (optional)"
            value={spendNote} onChange={(e) => setSpendNote(e.target.value)} />
          <button className={btnCls} onClick={addSpend}>Log</button>
        </div>
        <ul className="divide-y divide-gray-900">
          {monthSpends.slice(0, 10).map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="text-gray-200">{s.category}</span>
                <span className="text-gray-600 text-xs ml-2">{s.date}{s.note && ` · ${s.note}`}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-300">{gbp(s.amount)}</span>
                <button className={dangerBtnCls}
                  onClick={() => setSpends(spends.filter((x) => x.id !== s.id))}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
