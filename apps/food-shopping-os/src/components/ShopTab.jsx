import { useMemo, useState } from 'react';
import { Check, Coins, CreditCard, Play, ShoppingCart, Star, Store, Tag, Ticket, TrendingUp, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { gbp, cx } from '../lib/utils.js';
import { STORES, AISLE_ORDER, PRICE_HISTORY, fullList, totalOf, checkedTotalOf } from '../data/stores.js';
import { Section, Card, Pill, Sparkline, Meter, Chip } from './ui.jsx';

const VERDICT = {
  buy: { label: 'Buy now', tone: 'good' },
  wait: { label: 'Wait', tone: 'warn' },
  hold: { label: 'Stable', tone: 'muted' },
};

export default function ShopTab() {
  const app = useApp();
  const [view, setView] = useState('list'); // list | stores | prices
  const [shoppingMode, setShoppingMode] = useState(false);

  const list = useMemo(() => fullList(app.extraItems), [app.extraItems]);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const aisle of AISLE_ORDER) map.set(aisle, []);
    for (const item of list) map.get(item.aisle)?.push(item);
    return [...map.entries()].filter(([, items]) => items.length);
  }, [list]);

  const total = totalOf(list);
  const checkedTotal = checkedTotalOf(list, app.checked);
  const remaining = list.length - list.filter((i) => app.checked.includes(i.id)).length;
  const allowance = app.weeklyBudget - app.spentBase; // budget left for this trip
  const overBudget = total > allowance;

  return (
    <div className="pb-6 space-y-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Shop</h1>
        <div className="mt-3 flex gap-2 rise rise-1">
          {[['list', 'List', ShoppingCart], ['stores', 'Stores', Store], ['prices', 'Prices', TrendingUp]].map(([k, label, Icon]) => (
            <Chip key={k} active={view === k} onClick={() => setView(k)}>
              <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
            </Chip>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <>
          {/* Basket summary */}
          <Section className="rise rise-1">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                    {shoppingMode ? 'Running total' : 'Estimated basket'}
                  </p>
                  <p className="text-[24px] font-extrabold">
                    {gbp(shoppingMode ? checkedTotal : total, { always: true })}
                    {shoppingMode && <span className="text-[13px] font-semibold ml-1.5" style={{ color: 'var(--muted)' }}>of {gbp(total, { always: true })}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setShoppingMode(!shoppingMode)}
                  className="press rounded-2xl px-4 py-2.5 text-[13px] font-extrabold"
                  style={shoppingMode
                    ? { background: 'var(--card-2)', color: 'var(--ink)' }
                    : { background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {shoppingMode ? <><X size={14} /> Exit mode</> : <><Play size={14} fill="currentColor" /> Shopping mode</>}
                  </span>
                </button>
              </div>
              <div className="mt-3">
                <Meter value={shoppingMode ? checkedTotal : total} max={allowance} color={overBudget ? 'var(--warn)' : 'var(--accent)'} />
                <div className="mt-1.5 flex items-center justify-between text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                  <span>{list.length - remaining} of {list.length} items ticked</span>
                  <span className="inline-flex items-center gap-1" style={overBudget ? { color: 'var(--warn)', fontWeight: 700 } : {}}>
                    {overBudget && <TriangleAlert size={12} />}
                    {overBudget ? gbp(total - allowance, { always: true }) + ' over budget' : gbp(allowance - total, { always: true }) + ' headroom'}
                  </span>
                </div>
              </div>
              {shoppingMode && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--line)' }}>
                  <span className="pulse-dot inline-block h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
                  <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                    Route: {AISLE_ORDER.slice(0, 4).join(' → ')} … · Aldi, Riverside Retail Park
                  </p>
                </div>
              )}
            </Card>
          </Section>

          {/* Perks strip */}
          <div className="px-5 -mt-2 flex gap-2 overflow-x-auto no-scrollbar rise rise-2">
            <Pill tone="accent"><CreditCard size={12} /> Clubcard linked</Pill>
            <Pill tone="good"><Tag size={12} /> 4 items on offer</Pill>
            <Pill tone="muted"><Ticket size={12} /> 2 coupons ready</Pill>
            <Pill tone="muted"><Coins size={12} /> £1.20 cashback</Pill>
          </div>

          {/* Aisle-grouped checklist */}
          <Section className="rise rise-2" title={shoppingMode ? `${remaining} items to go` : 'This week’s list'}>
            <div className="space-y-4">
              {grouped.map(([aisle, items]) => {
                const allDone = items.every((i) => app.checked.includes(i.id));
                return (
                  <div key={aisle}>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: allDone ? 'var(--good)' : 'var(--faint)' }}>
                      {aisle} {allDone && '✓'}
                    </p>
                    <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
                      {items.map((item) => {
                        const done = app.checked.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => app.toggleChecked(item.id)}
                            className="press w-full flex items-center gap-3 p-3 text-left"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 transition-colors"
                              style={done
                                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
                                : { borderColor: 'var(--line)', color: 'transparent' }}
                            >
                              <Check size={13} strokeWidth={3} />
                            </span>
                            <Glyph e={item.emoji} size={20} style={{ color: 'var(--muted)' }} />
                            <span className="min-w-0 flex-1">
                              <span className={cx('block font-bold text-[14px] truncate', done && 'line-through opacity-45')}>
                                {item.name} <span className="font-semibold text-[12px]" style={{ color: 'var(--muted)' }}>· {item.qty}</span>
                              </span>
                              <span className="block text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                                Cheapest at {item.cheapest}
                                {item.alt && ` · ${item.alt.store} ${gbp(item.alt.price, { always: true })}`}
                              </span>
                            </span>
                            <span className="text-right shrink-0">
                              <span className={cx('block font-extrabold text-[14px]', done && 'opacity-45')}>{gbp(item.price, { always: true })}</span>
                              {item.sale && <Pill tone="good">offer</Pill>}
                            </span>
                          </button>
                        );
                      })}
                    </Card>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {view === 'stores' && (
        <Section className="rise rise-1" title="Store profiles">
          <div className="space-y-3">
            {STORES.map((s) => (
              <Card key={s.id}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold text-white shrink-0"
                    style={{ background: s.tone }}
                  >
                    {s.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-[15px]">{s.name}</p>
                      <Pill tone="muted"><Star size={11} fill="currentColor" /> {s.rating}</Pill>
                    </div>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                      {s.hours} · {s.delivery}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold uppercase" style={{ color: 'var(--faint)' }}>Basket index</p>
                    <p className="font-extrabold text-[16px]" style={{ color: s.basketIndex < 90 ? 'var(--good)' : s.basketIndex > 100 ? 'var(--warn)' : 'var(--ink)' }}>
                      {s.basketIndex}
                    </p>
                  </div>
                </div>
                {s.loyalty && (
                  <p className="mt-2 text-[12px] font-bold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                    <CreditCard size={13} /> {s.loyalty} · {s.points.toLocaleString()} points
                  </p>
                )}
                <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--line)' }}>
                  {s.offers.map((o) => (
                    <div key={o.item} className="flex items-center justify-between text-[13px]">
                      <span className="font-semibold truncate">{o.item}</span>
                      <span className="shrink-0 ml-2">
                        <span className="font-extrabold" style={{ color: 'var(--good)' }}>{o.deal}</span>
                        {o.was && <span className="ml-1.5 line-through text-[11.5px] font-semibold" style={{ color: 'var(--faint)' }}>{gbp(o.was, { always: true })}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <p className="text-[12px] font-semibold text-center" style={{ color: 'var(--faint)' }}>
              Basket index: your usual weekly basket priced per store (Tesco = 100).
            </p>
          </div>
        </Section>
      )}

      {view === 'prices' && (
        <Section className="rise rise-1" title="Price intelligence">
          <p className="-mt-1 mb-3 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
            12-week trends for your staples, with AI buy/wait calls.
          </p>
          <div className="space-y-3">
            {PRICE_HISTORY.map((p) => {
              const current = p.points[p.points.length - 1];
              const prev = p.points[p.points.length - 2];
              const delta = current - prev;
              const v = VERDICT[p.advice.verdict];
              return (
                <Card key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[14.5px] flex items-center gap-1.5">
                        <Glyph e={p.emoji} size={15} style={{ color: 'var(--muted)' }} /> {p.name}
                      </p>
                      <p className="text-[13px] font-bold mt-0.5">
                        {(current / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                        <span className="ml-1.5 text-[11.5px] font-bold" style={{ color: delta > 0 ? 'var(--danger)' : delta < 0 ? 'var(--good)' : 'var(--faint)' }}>
                          {delta > 0 ? `▲ ${delta}p` : delta < 0 ? `▼ ${-delta}p` : '· flat'}
                        </span>
                      </p>
                    </div>
                    <Sparkline points={p.points} color={delta > 0 ? 'var(--series-2)' : 'var(--series-1)'} />
                  </div>
                  <div className="mt-2.5 flex items-start gap-2">
                    <Pill tone={v.tone}>{v.label}</Pill>
                    <p className="text-[12.5px] font-semibold leading-snug flex-1" style={{ color: 'var(--muted)' }}>{p.advice.text}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
