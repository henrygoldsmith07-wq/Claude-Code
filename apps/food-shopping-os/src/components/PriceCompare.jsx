import { useMemo } from 'react';
import { Store, TrendingUp } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { priceHistory } from '../lib/kitchen.js';
import { compareStores, savingsAvailable } from '../lib/shopping.js';
import { Card, Pill, Sparkline, Section } from './ui.jsx';
import { Glyph } from './icons.jsx';

/**
 * Price comparison, built only from receipts you recorded.
 *
 * There is no price feed behind this app, so a comparison is only as good as
 * what you've actually paid — and it says how much of your list each shop can
 * price rather than quietly totalling two items and calling it a winner.
 */
export default function PriceCompare() {
  const app = useApp();
  const history = useMemo(() => priceHistory(app.shops), [app.shops]);
  const stores = useMemo(() => compareStores(app.shoppingList, app.shops), [app.shoppingList, app.shops]);
  const savings = useMemo(() => savingsAvailable(app.shoppingList, app.shops), [app.shoppingList, app.shops]);
  const best = stores.length ? [...stores].sort((a, b) => b.covered - a.covered || a.total - b.total)[0] : null;

  return (
    <>
      <Section className="rise rise-1" title="This list, shop by shop">
        {stores.length === 0 ? (
          <Card className="text-center py-8">
            <Store size={28} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
            <p className="font-bold">No comparison yet</p>
            <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
              Record a shop with prices against the items and Forq can price the same list
              at every shop you've been to. Nothing is fetched from anywhere.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {stores.map((row) => (
              <Card key={row.store} className="flex items-center justify-between !p-3.5">
                <div className="min-w-0">
                  <p className="font-bold text-[14.5px] truncate">{row.store}</p>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    prices known for {row.covered} of {row.of} item{row.of === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-[16px]">{gbp(row.total, { always: true })}</p>
                  {best && row.store === best.store && row.covered === best.covered && (
                    <Pill tone="good">best cover</Pill>
                  )}
                </div>
              </Card>
            ))}
            <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
              Totals only count items that shop has a price for, so two shops with different
              cover aren’t the same basket.
            </p>
          </div>
        )}
      </Section>

      {savings.length > 0 && (
        <Section className="rise rise-2" title="Cheaper elsewhere, going by your receipts">
          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            {savings.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-bold text-[14px] truncate">{s.name}</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                    you’ve paid {gbp(s.best, { always: true })} at {s.store}
                  </p>
                </div>
                <Pill tone="good">save {gbp(s.saving, { always: true })}</Pill>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section className="rise rise-2" title="What you actually pay">
        {history.length === 0 ? (
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
            {history.map((p) => (
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
    </>
  );
}
