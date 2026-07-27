import { useMemo, useState } from 'react';
import {
  Check, Play, Plus, Receipt, ShoppingCart, Trash2, TrendingUp, TriangleAlert, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { gbp, cx, prettyDate } from '../lib/utils.js';
import { COMMON_STORES, checkedTotalOf, groupByAisle, guessAisle, totalOf } from '../data/stores.js';
import { priceHistory, spentInWeek } from '../lib/kitchen.js';
import { Section, Card, Sparkline, Meter, Chip, Sheet } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

/* ---------- Add an item ---------- */

function AddItem({ onAdd }) {
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

function FinishShop({ items, onDone }) {
  const app = useApp();
  const suggested = checkedTotalOf(items);
  const [store, setStore] = useState('');
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
    </div>
  );
}

/* ---------- Tab ---------- */

export default function ShopTab() {
  const app = useApp();
  const [view, setView] = useState('list'); // list | history | prices
  const [shoppingMode, setShoppingMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const list = app.shoppingList;
  const grouped = useMemo(() => groupByAisle(list), [list]);
  const prices = useMemo(() => priceHistory(app.shops), [app.shops]);

  const total = totalOf(list);
  const checkedTotal = checkedTotalOf(list);
  const ticked = list.filter((i) => i.checked).length;
  const spent = spentInWeek(app.shops, app.day);
  const allowance = Math.max(0, app.weeklyBudget - spent);
  const overBudget = app.weeklyBudget > 0 && total > allowance;

  return (
    <div className="pb-6 space-y-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Shop</h1>
        <div className="mt-3 flex gap-2 rise rise-1">
          {[['list', 'List', ShoppingCart], ['history', 'Shops', Receipt], ['prices', 'Prices', TrendingUp]].map(([k, label, Icon]) => (
            <Chip key={k} active={view === k} onClick={() => setView(k)}>
              <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
            </Chip>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <>
          <Section className="rise rise-1">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                    {shoppingMode ? 'Running total' : 'Estimated basket'}
                  </p>
                  <p className="text-[24px] font-extrabold">
                    {gbp(shoppingMode ? checkedTotal : total, { always: true })}
                    {shoppingMode && (
                      <span className="text-[13px] font-semibold ml-1.5" style={{ color: 'var(--muted)' }}>
                        of {gbp(total, { always: true })}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShoppingMode(!shoppingMode)}
                  disabled={!list.length}
                  className="press rounded-2xl px-4 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
                  style={shoppingMode
                    ? { background: 'var(--card-2)', color: 'var(--ink)' }
                    : { background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {shoppingMode ? <><X size={14} /> Exit mode</> : <><Play size={14} fill="currentColor" /> Shopping mode</>}
                  </span>
                </button>
              </div>

              {app.weeklyBudget > 0 ? (
                <div className="mt-3">
                  <Meter value={spent + (shoppingMode ? checkedTotal : total)} max={app.weeklyBudget} color={overBudget ? 'var(--warn)' : 'var(--accent)'} />
                  <div className="mt-1.5 flex items-center justify-between text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    <span>{gbp(spent, { always: true })} spent this week</span>
                    <span className="inline-flex items-center gap-1" style={overBudget ? { color: 'var(--warn)', fontWeight: 700 } : {}}>
                      {overBudget && <TriangleAlert size={12} />}
                      {overBudget
                        ? `${gbp(total - allowance, { always: true })} over budget`
                        : `${gbp(allowance - total, { always: true })} headroom`}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                  Set a weekly budget in your profile to see headroom here.
                </p>
              )}

              {ticked > 0 && (
                <button
                  onClick={() => setFinishing(true)}
                  className="press mt-3 w-full rounded-2xl border py-2.5 text-[13px] font-extrabold"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Receipt size={14} /> Finish shop · {ticked} item{ticked === 1 ? '' : 's'}
                  </span>
                </button>
              )}
            </Card>
          </Section>

          <Section className="rise rise-2">
            <button
              onClick={() => setAdding((v) => !v)}
              className="press w-full rounded-2xl border py-3 text-[13.5px] font-extrabold mb-3"
              style={adding ? { borderColor: 'var(--line)' } : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                {adding ? <><X size={14} /> Close</> : <><Plus size={15} /> Add an item</>}
              </span>
            </button>
            {adding && <AddItem onAdd={(item) => app.addToList(item)} />}
          </Section>

          {list.length === 0 ? (
            <Section className="rise rise-2">
              <Card className="text-center py-10">
                <ShoppingCart size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
                <p className="font-bold">Nothing on the list yet</p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                  Add items here, send a recipe's missing ingredients over from a recipe page,
                  or flag something as running low in your pantry.
                </p>
              </Card>
            </Section>
          ) : (
            <Section className="rise rise-2" title={shoppingMode ? `${list.length - ticked} items to go` : 'Your list'}>
              <div className="space-y-4">
                {grouped.map(([aisle, items]) => {
                  const allDone = items.every((i) => i.checked);
                  return (
                    <div key={aisle}>
                      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: allDone ? 'var(--good)' : 'var(--faint)' }}>
                        {aisle} {allDone && '✓'}
                      </p>
                      <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--line)' }}>
                            <button
                              onClick={() => app.toggleChecked(item.id)}
                              aria-label={`Tick ${item.name}`}
                              className="press flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0"
                              style={item.checked
                                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
                                : { borderColor: 'var(--line)', color: 'transparent' }}
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                            <Glyph e={item.emoji} size={20} style={{ color: 'var(--muted)' }} />
                            <div className="min-w-0 flex-1">
                              <p className={cx('font-bold text-[14px] truncate', item.checked && 'line-through opacity-45')}>
                                {item.name}
                                {item.qty && <span className="font-semibold text-[12px]" style={{ color: 'var(--muted)' }}> · {item.qty}</span>}
                              </p>
                              {item.fromRecipe && (
                                <p className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--muted)' }}>
                                  for {item.fromRecipe}
                                </p>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={item.price || ''}
                              onChange={(e) => app.updateListItem(item.id, { price: Number(e.target.value) || 0 })}
                              placeholder="£"
                              aria-label={`Price of ${item.name}`}
                              className="w-16 shrink-0 rounded-xl border px-2 py-1.5 text-[13px] font-bold text-right outline-none"
                              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                            />
                            <button
                              onClick={() => app.removeListItem(item.id)}
                              aria-label={`Remove ${item.name}`}
                              className="press p-1 shrink-0"
                              style={{ color: 'var(--faint)' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}

      {view === 'history' && (
        <Section className="rise rise-1" title="Shops you’ve recorded">
          {app.shops.length === 0 ? (
            <Card className="text-center py-10">
              <Receipt size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
              <p className="font-bold">No shops recorded</p>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                Tick items off as you shop, then hit “Finish shop”. Spending, budget streaks
                and price trends all come from these.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...app.shops].reverse().map((s) => (
                <Card key={s.id} className="flex items-center justify-between !p-3.5">
                  <div className="min-w-0">
                    <p className="font-bold text-[14.5px] truncate">{s.store}</p>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                      {prettyDate(s.date)} · {s.items.length} item{s.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="font-extrabold text-[16px] shrink-0">{gbp(s.total, { always: true })}</p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {view === 'prices' && (
        <Section className="rise rise-1" title="What you actually pay">
          {prices.length === 0 ? (
            <Card className="text-center py-10">
              <TrendingUp size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
              <p className="font-bold">No price history yet</p>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                Put prices against items as you shop and Forq tracks what each one costs you
                over time — including where it was cheapest.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {prices.map((p) => (
                <Card key={p.name}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[14.5px] flex items-center gap-1.5">
                        <Glyph e={p.emoji} size={15} style={{ color: 'var(--muted)' }} /> {p.name}
                      </p>
                      <p className="text-[13px] font-bold mt-0.5">
                        {gbp(p.latest, { always: true })}
                        {p.change !== null && (
                          <span
                            className="ml-1.5 text-[11.5px] font-bold"
                            style={{ color: p.change > 0 ? 'var(--danger)' : p.change < 0 ? 'var(--good)' : 'var(--faint)' }}
                          >
                            {p.change > 0 ? `▲ ${gbp(p.change, { always: true })}` : p.change < 0 ? `▼ ${gbp(-p.change, { always: true })}` : '· flat'}
                          </span>
                        )}
                      </p>
                    </div>
                    {p.prices.length > 1 && <Sparkline points={p.prices} />}
                  </div>
                  <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    {p.times === 1
                      ? 'Bought once — buy it again to see a trend.'
                      : `Bought ${p.times} times · cheapest ${gbp(p.best, { always: true })}${p.bestStore ? ` at ${p.bestStore}` : ''}`}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finish shop">
        <FinishShop items={list} onDone={() => { setFinishing(false); setShoppingMode(false); }} />
      </Sheet>
    </div>
  );
}
