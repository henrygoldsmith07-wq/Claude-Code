import { useRef, useState } from 'react';
import { ExternalLink, PackageSearch, Store, Tag, Truck } from 'lucide-react';
import { RETAILERS, retailerBasket, retailerById, retailerOffers } from '../data/retailers.js';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { Card, Chip, Pill, Section } from './ui.jsx';

const ExternalButton = ({ href, children, primary = false }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="press inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[0.75rem] font-extrabold"
    style={primary
      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
      : { background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
  >
    {children} <ExternalLink size={12} />
  </a>
);

export default function StoreIntegrations() {
  const app = useApp();
  const [selectedId, setSelectedId] = useState('tesco');
  const [liveRows, setLiveRows] = useState({});
  const [liveState, setLiveState] = useState({});
  const [liveError, setLiveError] = useState('');
  const requestRef = useRef({ generation: 0, rows: {} });
  const selected = retailerById(selectedId);
  const basket = retailerBasket(selectedId, app.shoppingList, app.shops);
  const savedOffers = retailerOffers(selected, app.offers);
  const canDeliver = selected.fulfilment === 'delivery';

  const checkLive = async (row) => {
    const key = row.id || row.name;
    const generation = requestRef.current.generation;
    const requestId = (requestRef.current.rows[key] || 0) + 1;
    requestRef.current.rows[key] = requestId;
    const retailerId = selected.id;
    setLiveState((state) => ({ ...state, [key]: 'loading' }));
    setLiveError('');
    try {
      const response = await fetch(`/api/integrations/retailers?${new URLSearchParams({
        retailer: retailerId,
        query: row.name,
      })}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Live retailer data is unavailable.');
      if (generation !== requestRef.current.generation || requestId !== requestRef.current.rows[key]) return;
      setLiveRows((rows) => ({ ...rows, [key]: Array.isArray(body.products) ? body.products : [] }));
      setLiveState((state) => ({ ...state, [key]: 'ready' }));
    } catch (error) {
      if (generation !== requestRef.current.generation || requestId !== requestRef.current.rows[key]) return;
      setLiveState((state) => ({ ...state, [key]: 'error' }));
      setLiveError(error.message || 'Live retailer data is unavailable.');
    }
  };

  const selectRetailer = (id) => {
    requestRef.current = { generation: requestRef.current.generation + 1, rows: {} };
    setSelectedId(id);
    setLiveRows({});
    setLiveState({});
    setLiveError('');
  };

  const priceLabel = (result) => {
    if (result.price === null || result.price === undefined) return 'Price unavailable';
    const amount = result.currency === 'GBP' ? gbp(result.price, { always: true }) : `${result.currency} ${Number(result.price).toFixed(2)}`;
    if (result.unitPrice === null || result.unitPrice === undefined) return amount;
    return `${amount} · ${result.currency === 'GBP' ? gbp(result.unitPrice, { always: true }) : `${result.currency} ${Number(result.unitPrice).toFixed(2)}`} / ${result.unit || 'unit'}`;
  };

  return (
    <>
      <Section className="rise rise-1" title="UK retailers">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          {RETAILERS.map((retailer) => (
            <Chip
              key={retailer.id}
              active={retailer.id === selectedId}
              onClick={() => selectRetailer(retailer.id)}
            >
              {retailer.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section className="rise rise-1">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-extrabold text-[1.125rem]">
                <Store size={18} /> {selected.name}
              </p>
              <p className="mt-1 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                {canDeliver ? 'Online grocery delivery' : 'Browse prices · shop in store'}
              </p>
            </div>
            <Pill tone={canDeliver ? 'good' : 'muted'}>{canDeliver ? 'delivery' : 'in store'}</Pill>
          </div>
          <p className="mt-3 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
            Forq keeps your recorded prices and offers locally. A licensed feed can add a live product check; the retailer page remains the authority for the basket, stock and delivery slots.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExternalButton href={selected.offersUrl}>View {selected.name} offers</ExternalButton>
            {canDeliver ? (
              <ExternalButton href={selected.deliveryUrl} primary>Shop {selected.name} delivery</ExternalButton>
            ) : (
              <ExternalButton href={selected.shopUrl} primary>Browse {selected.name} groceries</ExternalButton>
            )}
          </div>
        </Card>
      </Section>

      <Section className="rise rise-2" title={`Your list at ${selected.name}`}>
        {liveError && (
          <p className="mb-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
            {liveError} Official retailer links below are still available.
          </p>
        )}
        {basket.rows.length === 0 ? (
          <Card className="text-center py-8">
            <PackageSearch size={28} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
            <p className="font-bold">Your shopping list is empty</p>
            <p className="mt-1 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
              Add an item, then use its retailer link to check today’s price and availability.
            </p>
          </Card>
        ) : (
          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            <div className="p-3" style={{ borderColor: 'var(--line)' }}>
              <p className="font-bold text-[0.8125rem]">
                Recorded prices for {basket.covered} of {basket.of} item{basket.of === 1 ? '' : 's'}
                {basket.covered > 0 && ` · ${gbp(basket.total, { always: true })}`}
              </p>
              <p className="mt-0.5 text-[0.71875rem] font-semibold" style={{ color: 'var(--muted)' }}>
                This total uses your latest recorded {selected.name} prices, not a live feed.
              </p>
            </div>
            {basket.rows.map((row) => (
              <div key={row.id || row.name} data-retailer-item className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[0.84375rem] truncate">{row.name}</p>
                    <p className="text-[0.71875rem] font-semibold" style={{ color: row.price === null ? 'var(--faint)' : 'var(--good)' }}>
                      {row.price === null ? 'No recorded price' : `${gbp(row.price, { always: true })} recorded`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => checkLive(row)}
                      disabled={liveState[row.id || row.name] === 'loading'}
                      className="press rounded-xl border px-2.5 py-2 text-[0.6875rem] font-extrabold disabled:opacity-50"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      {liveState[row.id || row.name] === 'loading' ? 'Checking…' : 'Check live feed'}
                    </button>
                    <a
                      href={row.searchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="press inline-flex items-center gap-1 text-[0.71875rem] font-bold"
                      style={{ color: 'var(--accent)' }}
                    >
                      Check price & availability <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
                {liveRows[row.id || row.name]?.length > 0 && (
                  <div className="mt-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--line)', background: 'var(--card-2)' }}>
                    {liveRows[row.id || row.name].slice(0, 3).map((result, index) => (
                      <div key={`${result.id || result.name}-${index}`} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-[0.75rem] font-bold truncate">{result.name}</p>
                          <p className="text-[0.6875rem] font-semibold" style={{ color: result.availability === 'available' ? 'var(--good)' : 'var(--muted)' }}>
                            {priceLabel(result)} · {result.availability}
                          </p>
                          {result.offer && <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--muted)' }}>{result.offer}</p>}
                        </div>
                        <span className="shrink-0 text-right text-[0.625rem] font-bold" style={{ color: 'var(--faint)' }}>
                          {result.sourceLabel || 'Licensed provider'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {liveState[row.id || row.name] === 'ready' && liveRows[row.id || row.name]?.length === 0 && (
                  <p className="mt-2 text-[0.6875rem] font-semibold" style={{ color: 'var(--muted)' }}>
                    The configured provider returned no matching product. Nothing has been filled in.
                  </p>
                )}
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section className="rise rise-2" title="Offers">
        <Card>
          <p className="flex items-center gap-2 font-bold text-[0.84375rem]">
            <Tag size={15} /> {savedOffers.length
              ? `${savedOffers.length} saved offer${savedOffers.length === 1 ? '' : 's'} can apply`
              : `No saved ${selected.name} offers`}
          </p>
          {savedOffers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {savedOffers.map((offer) => (
                <li key={offer.id} className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  {offer.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[0.71875rem] font-semibold" style={{ color: 'var(--faint)' }}>
            Official offers can change. Open the retailer page before relying on one.
          </p>
        </Card>
      </Section>

      <Section className="rise rise-2" title="Delivery & collection">
        <Card className="flex items-start gap-3">
          <Truck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="font-bold text-[0.84375rem]">
              {canDeliver ? 'Check slots and postcode availability' : 'No direct full-basket grocery delivery'}
            </p>
            <p className="mt-1 text-[0.71875rem] font-semibold" style={{ color: 'var(--muted)' }}>
              {canDeliver
                ? `${selected.name} confirms the products, substitutions, delivery charge and available times at checkout.`
                : `${selected.name} products can be browsed here, but the weekly shop is completed in store.`}
            </p>
          </div>
        </Card>
      </Section>
    </>
  );
}
