'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Direction = 'they-owe' | 'i-owe';

interface Iou {
  id: string;
  who: string;
  amount: number;
  direction: Direction;
  note: string;
  settled: boolean;
}

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function OwedPage() {
  const [ious, setIous] = useStoredState<Iou[]>('os.money.owed', []);
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('they-owe');
  const [note, setNote] = useState('');

  const add = () => {
    const a = parseFloat(amount);
    if (!who.trim() || isNaN(a) || a <= 0) return;
    setIous([{ id: uid(), who: who.trim(), amount: a, direction, note: note.trim(), settled: false }, ...ious]);
    setWho(''); setAmount(''); setNote('');
  };

  const open = ious.filter((i) => !i.settled);
  const net = open.reduce((s, i) => s + (i.direction === 'they-owe' ? i.amount : -i.amount), 0);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Money OS', href: '/os/money' }, { name: 'Owed & Owing' }]}
      icon="💸" title="Owed & Owing" tagline="IOUs both directions — friendships survive better written down.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Who" value={who} onChange={(e) => setWho(e.target.value)} />
          <select className={inputCls} value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="they-owe">They owe me</option>
            <option value="i-owe">I owe them</option>
          </select>
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="£"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[140px]`} placeholder="For what"
            value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btnCls} onClick={add}>Add</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            Net{' '}
            <span className={`font-semibold ${net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-300'}`}>
              {net >= 0 ? '+' : '−'}{gbp(Math.abs(net))}
            </span>
          </span>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Outstanding · {open.length}</h2>
        {open.length === 0 && <p className="text-sm text-gray-600">All square with everyone.</p>}
        <ul className="space-y-2">
          {open.map((iou) => (
            <li key={iou.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                {iou.direction === 'they-owe'
                  ? <><span className="text-green-400">{iou.who} owes you</span> {gbp(iou.amount)}</>
                  : <><span className="text-red-400">You owe {iou.who}</span> {gbp(iou.amount)}</>}
                {iou.note && <span className="text-gray-600 text-xs ml-2">{iou.note}</span>}
              </span>
              <span className="flex items-center gap-2">
                <button className={btnCls}
                  onClick={() => setIous(ious.map((i) => i.id === iou.id ? { ...i, settled: true } : i))}>
                  Settled
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setIous(ious.filter((i) => i.id !== iou.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
