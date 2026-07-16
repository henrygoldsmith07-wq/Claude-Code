'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Gift {
  id: string;
  person: string;
  occasion: string;
  idea: string;
  budget: number;
  bought: boolean;
}

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function GiftPlannerPage() {
  const [gifts, setGifts] = useStoredState<Gift[]>('os.money.gifts', []);
  const [person, setPerson] = useState('');
  const [occasion, setOccasion] = useState('');
  const [idea, setIdea] = useState('');
  const [budget, setBudget] = useState('');

  const add = () => {
    const b = parseFloat(budget);
    if (!person.trim() || isNaN(b)) return;
    setGifts([{ id: uid(), person: person.trim(), occasion: occasion.trim() || 'Birthday', idea: idea.trim(), budget: b, bought: false }, ...gifts]);
    setPerson(''); setOccasion(''); setIdea(''); setBudget('');
  };

  const pending = gifts.filter((g) => !g.bought);
  const toSpend = pending.reduce((s, g) => s + g.budget, 0);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Money OS', href: '/os/money' }, { name: 'Gift Planner' }]}
      icon="🎀" title="Gift Planner" tagline="Who, what, budget — sorted before the panic-buy.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Person" value={person} onChange={(e) => setPerson(e.target.value)} />
          <input className={inputCls} placeholder="Occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Gift idea"
            value={idea} onChange={(e) => setIdea(e.target.value)} />
          <input className={inputCls} type="number" step="1" min="0" placeholder="Budget £"
            value={budget} onChange={(e) => setBudget(e.target.value)} />
          <button className={btnCls} onClick={add}>Plan</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            To spend <span className="text-white font-semibold">{gbp(toSpend)}</span>
          </span>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Planned · {pending.length}</h2>
        {pending.length === 0 && <p className="text-sm text-gray-600">Nobody to buy for right now.</p>}
        <ul className="space-y-2">
          {pending.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                🎀 {g.person} <span className="text-gray-600">({g.occasion})</span>
                {g.idea && <span className="text-gray-400"> — {g.idea}</span>}
                <span className="text-gray-500 ml-2">{gbp(g.budget)}</span>
              </span>
              <span className="flex items-center gap-2">
                <button className={btnCls}
                  onClick={() => setGifts(gifts.map((x) => x.id === g.id ? { ...x, bought: true } : x))}>
                  Bought
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setGifts(gifts.filter((x) => x.id !== g.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-green-400 mb-4">Bought</h2>
        <ul className="divide-y divide-gray-900">
          {gifts.filter((g) => g.bought).map((g) => (
            <li key={g.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 line-through">{g.person} — {g.idea || g.occasion}</span>
              <button className={dangerBtnCls}
                onClick={() => setGifts(gifts.filter((x) => x.id !== g.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
