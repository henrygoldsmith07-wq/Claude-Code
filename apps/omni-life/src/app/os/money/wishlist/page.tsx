'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Priority = 'must' | 'want' | 'someday';

interface Item {
  id: string;
  name: string;
  price: number;
  priority: Priority;
  bought: boolean;
}

const priorities: { id: Priority; label: string; order: number }[] = [
  { id: 'must', label: '🔥 Must have', order: 0 },
  { id: 'want', label: '⭐ Want', order: 1 },
  { id: 'someday', label: '💭 Someday', order: 2 },
];

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function WishlistPage() {
  const [items, setItems] = useStoredState<Item[]>('os.money.wishlist', []);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState<Priority>('want');

  const addItem = () => {
    const p = parseFloat(price);
    if (!name.trim() || isNaN(p) || p < 0) return;
    setItems([...items, { id: uid(), name: name.trim(), price: p, priority, bought: false }]);
    setName('');
    setPrice('');
  };

  const order = (p: Priority) => priorities.find((x) => x.id === p)!.order;
  const open = items.filter((i) => !i.bought).sort((a, b) => order(a.priority) - order(b.priority) || a.price - b.price);
  const bought = items.filter((i) => i.bought);
  const openTotal = open.reduce((s, i) => s + i.price, 0);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Money OS', href: '/os/money' },
        { name: 'Wishlist' },
      ]}
      icon="🎁"
      title="Wishlist"
      tagline="Park the impulse here — if it still matters in a week, it earns its price."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Thing you want"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="Price £"
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className={btnCls} onClick={addItem}>Add</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            Open list costs <span className="text-white font-semibold">{gbp(openTotal)}</span>
          </span>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Wanted</h2>
        {open.length === 0 && <p className="text-sm text-gray-600">Nothing on the list. Impressive restraint.</p>}
        <ul className="space-y-2">
          {open.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                {priorities.find((p) => p.id === item.priority)!.label.split(' ')[0]} {item.name}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-gray-400">{gbp(item.price)}</span>
                <button className={btnCls}
                  onClick={() => setItems(items.map((i) => i.id === item.id ? { ...i, bought: true } : i))}>
                  Bought
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setItems(items.filter((i) => i.id !== item.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Bought</h2>
        {bought.length === 0 && <p className="text-sm text-gray-600">Nothing bought off the list yet.</p>}
        <ul className="divide-y divide-gray-900">
          {bought.map((item) => (
            <li key={item.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 line-through">{item.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-gray-600">{gbp(item.price)}</span>
                <button className={dangerBtnCls}
                  onClick={() => setItems(items.filter((i) => i.id !== item.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
