import { useState } from 'react';
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
    className="press inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-extrabold"
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
  const selected = retailerById(selectedId);
  const basket = retailerBasket(selectedId, app.shoppingList, app.shops);
  const savedOffers = retailerOffers(selected, app.offers);
  const canDeliver = selected.fulfilment === 'delivery';

  return (
    <>
      <Section className="rise rise-1" title="UK retailers">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          {RETAILERS.map((retailer) => (
            <Chip
              key={retailer.id}
              active={retailer.id === selectedId}
              onClick={() => setSelectedId(retailer.id)}
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
              <p className="flex items-center gap-2 font-extrabold text-[18px]">
                <Store size={18} /> {selected.name}
              </p>
              <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                {canDeliver ? 'Online grocery delivery' : 'Browse prices · shop in store'}
              </p>
            </div>
            <Pill tone={canDeliver ? 'good' : 'muted'}>{canDeliver ? 'delivery' : 'in store'}</Pill>
          </div>
          <p className="mt-3 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
            Forq keeps your recorded prices and offers locally. Current prices, stock and slots are checked on {selected.name}.
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
        {basket.rows.length === 0 ? (
          <Card className="text-center py-8">
            <PackageSearch size={28} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
            <p className="font-bold">Your shopping list is empty</p>
            <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
              Add an item, then use its retailer link to check today’s price and availability.
            </p>
          </Card>
        ) : (
          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            <div className="p-3" style={{ borderColor: 'var(--line)' }}>
              <p className="font-bold text-[13px]">
                Recorded prices for {basket.covered} of {basket.of} item{basket.of === 1 ? '' : 's'}
                {basket.covered > 0 && ` · ${gbp(basket.total, { always: true })}`}
              </p>
              <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                This total uses your latest recorded {selected.name} prices, not a live feed.
              </p>
            </div>
            {basket.rows.map((row) => (
              <div key={row.id || row.name} data-retailer-item className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-bold text-[13.5px] truncate">{row.name}</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: row.price === null ? 'var(--faint)' : 'var(--good)' }}>
                    {row.price === null ? 'No recorded price' : `${gbp(row.price, { always: true })} recorded`}
                  </p>
                </div>
                <a
                  href={row.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="press shrink-0 inline-flex items-center gap-1 text-[11.5px] font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  Check price & availability <ExternalLink size={11} />
                </a>
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section className="rise rise-2" title="Offers">
        <Card>
          <p className="flex items-center gap-2 font-bold text-[13.5px]">
            <Tag size={15} /> {savedOffers.length
              ? `${savedOffers.length} saved offer${savedOffers.length === 1 ? '' : 's'} can apply`
              : `No saved ${selected.name} offers`}
          </p>
          {savedOffers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {savedOffers.map((offer) => (
                <li key={offer.id} className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                  {offer.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11.5px] font-semibold" style={{ color: 'var(--faint)' }}>
            Official offers can change. Open the retailer page before relying on one.
          </p>
        </Card>
      </Section>

      <Section className="rise rise-2" title="Delivery & collection">
        <Card className="flex items-start gap-3">
          <Truck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="font-bold text-[13.5px]">
              {canDeliver ? 'Check slots and postcode availability' : 'No direct full-basket grocery delivery'}
            </p>
            <p className="mt-1 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
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
