import { useState } from 'react';
import { Check, Plus, Receipt } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { COMMON_STORES, checkedTotalOf, guessAisle } from '../data/stores.js';
import { Card, Chip } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

/**
 * The two forms the shop tab needs: putting something on the list, and
 * recording what a trip actually cost once you're at the till.
 */

/* ---------- Add an item ---------- */

export function AddItem({ onAdd }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const submit = () => {
    if (name.trim().length < 2) return;
    onAdd({ name: name.trim(), qty: qty.trim(), price: Number(price) || 0, aisle: guessAisle(name) });
    setName(''); setQty(''); setPrice('');
  };

  return (
    <Card className="space-y-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Add to the list…"
        aria-label="Item name"
        className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Amount</span>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="2, 500 g…"
            aria-label="Amount"
            className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </label>
        <NumberField label="Price each" value={price} onChange={setPrice} suffix="£" step={0.5} />
      </div>
      <button
        onClick={submit}
        disabled={name.trim().length < 2}
        className="press w-full rounded-2xl py-2.5 text-[13.5px] font-extrabold disabled:opacity-40"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Add item</span>
      </button>
    </Card>
  );
}

/* ---------- Record what a trip cost ---------- */

export function FinishShop({ items, store: initial, onDone }) {
  const app = useApp();
  const suggested = checkedTotalOf(items);
  const [store, setStore] = useState(initial || '');
  const [total, setTotal] = useState(suggested ? suggested.toFixed(2) : '');
  const [toPantry, setToPantry] = useState(true);

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card>
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Ticked off</p>
        <p className="text-[26px] font-extrabold">{items.filter((i) => i.checked).length} items</p>
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          Estimated {gbp(suggested, { always: true })} — put in what you actually paid.
        </p>
      </Card>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Where</span>
        <input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Shop name"
          aria-label="Shop name"
          className="mt-1 w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
      </label>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {COMMON_STORES.map((s) => (
          <Chip key={s} active={store === s} onClick={() => setStore(s)}>{s}</Chip>
        ))}
      </div>

      <NumberField label="Total paid" value={total} onChange={setTotal} suffix="£" step={1} />

      <button
        onClick={() => setToPantry((v) => !v)}
        className="press w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left"
        style={{ borderColor: toPantry ? 'var(--accent)' : 'var(--line)' }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0"
          style={toPantry
            ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
            : { borderColor: 'var(--line)', color: 'transparent' }}
        >
          <Check size={13} strokeWidth={3} />
        </span>
        <span>
          <span className="block font-bold text-[14px]">Put these in the pantry</span>
          <span className="block text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
            You can add use-by dates afterwards.
          </span>
        </span>
      </button>

      <button
        onClick={() => { app.recordShop({ store, total, toPantry }); onDone(); }}
        className="press w-full rounded-2xl py-3.5 text-[15px] font-extrabold"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        <span className="inline-flex items-center gap-2"><Receipt size={16} /> Record this shop</span>
      </button>
      <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
        The order you ticked things off becomes this shop’s aisle order next time.
      </p>
    </div>
  );
}
