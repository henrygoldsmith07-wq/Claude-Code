'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Watch {
  id: string;
  item: string;
  current: number;
  target: number;
  url: string;
}

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function PriceWatchPage() {
  const [watches, setWatches] = useStoredState<Watch[]>('os.money.pricewatch', []);
  const [item, setItem] = useState('');
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('');
  const [url, setUrl] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  const add = () => {
    const c = parseFloat(current);
    const t = parseFloat(target);
    if (!item.trim() || isNaN(c) || isNaN(t)) return;
    setWatches([{ id: uid(), item: item.trim(), current: c, target: t, url: url.trim() }, ...watches]);
    setItem(''); setCurrent(''); setTarget(''); setUrl('');
  };

  const update = (w: Watch) => {
    const c = parseFloat(edits[w.id] ?? '');
    if (isNaN(c)) return;
    setWatches(watches.map((x) => x.id === w.id ? { ...x, current: c } : x));
    setEdits({ ...edits, [w.id]: '' });
  };

  const hit = watches.filter((w) => w.current <= w.target);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Money OS', href: '/os/money' }, { name: 'Price Watch' }]}
      icon="📉" title="Price Watch" tagline="Name your price and wait it out — update the current price when you check.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Item"
            value={item} onChange={(e) => setItem(e.target.value)} />
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="Current £"
            value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input className={inputCls} type="number" step="0.01" min="0" placeholder="Buy at £"
            value={target} onChange={(e) => setTarget(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[140px]`} placeholder="Link (optional)"
            value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className={btnCls} onClick={add}>Watch</button>
        </div>
        {hit.length > 0 && (
          <p className="text-xs text-green-400 mt-3">
            🎯 At or below target: {hit.map((w) => w.item).join(', ')}
          </p>
        )}
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Watching · {watches.length}</h2>
        {watches.length === 0 && <p className="text-sm text-gray-600">Not watching anything.</p>}
        <ul className="space-y-3">
          {watches.map((w) => {
            const ready = w.current <= w.target;
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-gray-200">
                  {ready && '🎯 '}
                  {w.url
                    ? <a href={w.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{w.item} ↗</a>
                    : w.item}
                  <span className={`ml-2 ${ready ? 'text-green-400' : 'text-gray-400'}`}>{gbp(w.current)}</span>
                  <span className="text-gray-600"> / buy at {gbp(w.target)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <input className={`${inputCls} w-28`} type="number" step="0.01" placeholder="New price"
                    value={edits[w.id] ?? ''}
                    onChange={(e) => setEdits({ ...edits, [w.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && update(w)} />
                  <button className={btnCls} onClick={() => update(w)}>Set</button>
                  <button className={dangerBtnCls}
                    onClick={() => setWatches(watches.filter((x) => x.id !== w.id))}>✕</button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </OsShell>
  );
}
