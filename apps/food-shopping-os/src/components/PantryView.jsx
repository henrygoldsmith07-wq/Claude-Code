import { useMemo, useState } from 'react';
import {
  Camera, Check, Package, Plus, ScanLine, ShoppingCart, Trash2, TrendingDown, TriangleAlert, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { cx, gbp, expiryStatus } from '../lib/utils.js';
import { daysUntil, expiringSoon, pantryValue } from '../lib/kitchen.js';
import { expiryBuckets } from '../lib/shopping.js';
import { CATEGORIES, DEFAULT_CATEGORY, DEFAULT_LOCATION, LOCATIONS } from '../data/pantry.js';
import { Card, Chip, Empty, Pill, Section } from './ui.jsx';
import { Glyph } from './icons.jsx';
import { NumberField } from './FoodDetail.jsx';
import PantryCapture from './PantryCapture.jsx';
import BarcodeAdd from './BarcodeAdd.jsx';

const BLANK = {
  name: '', qty: '', cost: '', location: DEFAULT_LOCATION,
  cat: DEFAULT_CATEGORY, store: '', expiry: '',
};

function AddItemForm() {
  const app = useApp();
  const [draft, setDraft] = useState(BLANK);
  const [added, setAdded] = useState(null);
  const field = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  /** Stays open after saving — putting a shop away means several items in a row. */
  const save = () => {
    if (draft.name.trim().length < 2) return;
    app.addPantryItem({ ...draft, name: draft.name.trim(), expiry: draft.expiry || null });
    setAdded(draft.name.trim());
    setDraft({ ...BLANK, location: draft.location, cat: draft.cat, store: draft.store });
  };

  return (
    <Card className="space-y-3">
      <input
        value={draft.name}
        onChange={(e) => field('name')(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="What did you put away?"
        aria-label="Item name"
        className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Amount</span>
          <input
            value={draft.qty}
            onChange={(e) => field('qty')(e.target.value)}
            placeholder="500 g, 2 tins…"
            aria-label="Amount"
            className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </label>
        <NumberField label="Cost" value={draft.cost} onChange={field('cost')} suffix="£" step={0.5} />
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Use by</span>
          <input
            type="date"
            value={draft.expiry}
            onChange={(e) => field('expiry')(e.target.value)}
            aria-label="Use by"
            className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Where from</span>
          <input
            value={draft.store}
            onChange={(e) => field('store')(e.target.value)}
            placeholder="Shop"
            aria-label="Where from"
            className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {LOCATIONS.map((l) => (
          <Chip key={l} active={draft.location === l} onClick={() => field('location')(l)}>{l}</Chip>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={draft.cat === c} onClick={() => field('cat')(c)}>{c}</Chip>
        ))}
      </div>
      <button
        onClick={save}
        disabled={draft.name.trim().length < 2}
        className="press w-full rounded-2xl py-3 text-[14px] font-extrabold disabled:opacity-40"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        Add to pantry
      </button>
      {added && (
        <p className="text-center"><Pill tone="good"><Check size={11} strokeWidth={3} /> {added} added</Pill></p>
      )}
    </Card>
  );
}

export default function PantryView() {
  const app = useApp();
  const [location, setLocation] = useState('All');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [scanning, setScanning] = useState(false);

  const items = useMemo(() => {
    let list = app.pantry;
    if (location !== 'All') list = list.filter((p) => p.location === location);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.cat || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const da = a.expiry ? daysUntil(a.expiry, app.day) : 9999;
      const db = b.expiry ? daysUntil(b.expiry, app.day) : 9999;
      return da - db;
    });
  }, [app.pantry, app.day, location, query]);

  const expiring = expiringSoon(app.pantry, 3, app.day);
  const buckets = useMemo(
    () => expiryBuckets(app.pantry, (stamp) => daysUntil(stamp, app.day)),
    [app.pantry, app.day],
  );
  const undated = app.pantry.filter((p) => !p.expiry).length;
  const empty = app.pantry.length === 0;

  return (
    <div className="px-5 pb-8 space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [gbp(pantryValue(app.pantry), { always: true }), 'pantry value'],
          [app.pantry.length, 'items tracked'],
          [expiring.length, 'use soon'],
        ].map(([v, label]) => (
          <Card key={label} className="!p-3 text-center">
            <p className="text-[17px] font-extrabold">{v}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => { setAdding((v) => !v); setCapturing(false); setScanning(false); }}
          className="press rounded-2xl border py-3 text-[13.5px] font-extrabold"
          style={adding ? { borderColor: 'var(--line)' } : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            {adding ? <><X size={14} /> Close</> : <><Plus size={15} /> Add an item</>}
          </span>
        </button>
        <button
          onClick={() => { setCapturing((v) => !v); setAdding(false); setScanning(false); }}
          className="press rounded-2xl border py-3 text-[13.5px] font-extrabold"
          style={capturing ? { borderColor: 'var(--line)' } : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            {capturing ? <><X size={14} /> Close</> : <><Camera size={15} /> Add by photo</>}
          </span>
        </button>
      </div>
      <button
        onClick={() => { setScanning((v) => !v); setAdding(false); setCapturing(false); }}
        className="press w-full rounded-2xl border py-2.5 text-[13px] font-extrabold"
        style={scanning ? { borderColor: 'var(--line)' } : { borderColor: 'var(--line)', color: 'var(--muted)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          {scanning ? <><X size={14} /> Close</> : <><ScanLine size={14} /> Scan a barcode in</>}
        </span>
      </button>
      {adding && <AddItemForm />}
      {capturing && <PantryCapture onDone={() => setCapturing(false)} />}
      {scanning && (
        <Card>
          <BarcodeAdd
            action="Put away"
            onPick={(item) => app.addPantryItem({ ...item, cat: DEFAULT_CATEGORY, location: DEFAULT_LOCATION, qty: '', cost: 0, expiry: null })}
          />
        </Card>
      )}

      {/* What's going off, and what waste has cost you */}
      {(buckets.length > 0 || app.wasted.count > 0) && (
        <Section title="Use-by dates" className="!px-0">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="mb-2.5">
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: bucket.id === 'gone' ? 'var(--danger)' : 'var(--faint)' }}>
                {bucket.label} · {bucket.items.length}
              </p>
              <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
                {bucket.items.map(({ item, days }) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <Glyph e={item.emoji} size={20} style={{ color: 'var(--muted)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[14px] truncate">{item.name}</p>
                      <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                        {expiryStatus(days).label}{item.cost > 0 ? ` · ${gbp(item.cost, { always: true })}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => app.binPantryItem(item.id)}
                      className="press rounded-full border px-3 py-1.5 text-[12px] font-extrabold shrink-0"
                      style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
                    >
                      Threw it away
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
          {undated > 0 && (
            <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
              {undated} item{undated === 1 ? ' has' : 's have'} no use-by date, so {undated === 1 ? 'it isn’t' : 'they aren’t'} tracked here.
            </p>
          )}
          {app.wasted.count > 0 && (
            <Card className="mt-2 flex items-center gap-3 !p-3">
              <TrendingDown size={16} style={{ color: 'var(--muted)' }} />
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                You’ve binned {app.wasted.count} item{app.wasted.count === 1 ? '' : 's'}, worth{' '}
                {gbp(app.wasted.cost, { always: true })} at what you paid
                {app.wasted.worst?.cost > 0 && ` — the priciest was ${app.wasted.worst.name}`}.
              </p>
            </Card>
          )}
        </Section>
      )}

      {empty ? (
        <Card className="text-center py-10">
          <Package size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
          <p className="font-bold">Your pantry is empty</p>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
            Add what you have in and Forq can tell you what's about to go off, what a
            recipe still needs, and what your kitchen is worth.
          </p>
        </Card>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your pantry…"
            aria-label="Search pantry"
            className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {['All', ...LOCATIONS].map((loc) => (
              <Chip key={loc} active={location === loc} onClick={() => setLocation(loc)}>{loc}</Chip>
            ))}
          </div>

          {location === 'All' && !query && expiring.length > 0 && (
            <Section title="Use soon" className="!px-0">
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5">
                {expiring.map((p) => {
                  const st = expiryStatus(daysUntil(p.expiry, app.day));
                  return (
                    <Card key={p.id} className="w-[150px] shrink-0 !p-3">
                      <Glyph e={p.emoji} size={22} style={{ color: 'var(--muted)' }} />
                      <p className="mt-1 font-bold text-[13px] leading-tight">{p.name}</p>
                      <div className="mt-1.5"><Pill tone={st.tone}>{st.label}</Pill></div>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          {items.length === 0 && (
            app.pantry.length === 0 ? (
              <Empty
                Icon={Package}
                title="Your pantry is empty"
                action="Add an item"
                onAction={() => { setAdding(true); setCapturing(false); setScanning(false); }}
                note="Or photograph a shelf, or scan a barcode."
              >
                Until it knows what you have, recipes can’t say what you’re missing and nothing can
                warn you about a use-by date.
              </Empty>
            ) : (
              <Empty title="Nothing matches">
                {query.trim()
                  ? `No pantry item matches “${query.trim()}”.`
                  : `Nothing is stored in ${location.toLowerCase()} right now.`}
              </Empty>
            )
          )}

          <Card className={cx('!p-0 divide-y', items.length === 0 && 'hidden')} style={{ borderColor: 'var(--line)' }}>
            {items.map((p) => {
              const days = p.expiry ? daysUntil(p.expiry, app.day) : null;
              const st = days === null ? null : expiryStatus(days);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--line)' }}>
                  <Glyph e={p.emoji} size={22} style={{ color: 'var(--muted)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[14px] truncate">{p.name}</p>
                    <p className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--muted)' }}>
                      {[p.qty, p.location, p.store].filter(Boolean).join(' · ') || p.cat}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.cost > 0 && <p className="font-bold text-[13px]">{gbp(p.cost, { always: true })}</p>}
                    {st && <Pill tone={st.tone}>{st.label}</Pill>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => app.togglePantryLow(p.id)}
                      aria-label={`Mark ${p.name} ${p.low ? 'stocked' : 'running low'}`}
                      className="press p-1"
                      style={{ color: p.low ? 'var(--warn)' : 'var(--faint)' }}
                    >
                      {p.low ? <TriangleAlert size={15} /> : <Check size={15} />}
                    </button>
                    <button
                      onClick={() => app.removePantryItem(p.id)}
                      aria-label={`Remove ${p.name}`}
                      className="press p-1"
                      style={{ color: 'var(--faint)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>

          {app.pantry.some((p) => p.low) && (
            <button
              onClick={() => app.addToList(app.pantry.filter((p) => p.low).map((p) => ({ name: p.name, emoji: p.emoji, qty: p.qty })))}
              className="press w-full rounded-2xl border py-3 text-[13.5px] font-extrabold"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShoppingCart size={15} /> Add {app.pantry.filter((p) => p.low).length} low items to the shopping list
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
