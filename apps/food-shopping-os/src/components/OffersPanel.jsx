import { useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { applyOffers, OFFER_KINDS } from '../lib/shopping.js';
import { Card, Chip, Pill } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

const BLANK = { label: '', match: '', kind: 'money', value: '', store: '' };

/**
 * Offers and coupons.
 *
 * Forq has no deals feed and no retailer connection, so it will never tell you
 * about a discount you didn't already know about. What it does do is take the
 * offers you *have* — a voucher, an email, a shelf edge — and work out what
 * they're worth against the list you're actually holding.
 */
export default function OffersPanel() {
  const app = useApp();
  const [draft, setDraft] = useState(BLANK);
  const field = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const kind = OFFER_KINDS.find((k) => k.id === draft.kind);
  const { lines, saved } = applyOffers(app.shoppingList, app.offers);

  const add = () => {
    if (draft.label.trim().length < 2 || !draft.match.trim()) return;
    app.addOffer(draft);
    setDraft(BLANK);
  };

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card>
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>On your list</p>
        <p className="mt-0.5 text-[22px] font-extrabold">{gbp(saved, { always: true })}</p>
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          {app.offers.length === 0
            ? 'No offers yet. Nothing here is fetched from a shop — add the ones you actually have.'
            : lines.length === 0
              ? 'None of your offers match anything on the list yet.'
              : `${lines.length} offer${lines.length === 1 ? '' : 's'} apply to what you’re buying.`}
        </p>
      </Card>

      {app.offers.length > 0 && (
        <div className="space-y-2.5">
          {app.offers.map((offer) => {
            const line = lines.find((l) => l.offer.id === offer.id);
            return (
              <Card key={offer.id} className="flex items-start gap-3 !p-3">
                <Tag size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[14px]">{offer.label}</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                    matches “{offer.match}”{offer.store ? ` · ${offer.store}` : ''}
                  </p>
                  {line
                    ? <p className="mt-1"><Pill tone="good">saves {gbp(line.saved, { always: true })} on {line.items.length} item{line.items.length === 1 ? '' : 's'}</Pill></p>
                    : <p className="mt-1"><Pill tone="faint">nothing on the list matches</Pill></p>}
                </div>
                <button
                  onClick={() => app.removeOffer(offer.id)}
                  aria-label={`Remove ${offer.label}`}
                  className="press p-1 shrink-0"
                  style={{ color: 'var(--faint)' }}
                >
                  <Trash2 size={15} />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Add an offer</p>
        <input
          value={draft.label}
          onChange={(e) => field('label')(e.target.value)}
          placeholder={`What it says — “${kind.hint} pasta”`}
          aria-label="Offer description"
          className="w-full rounded-2xl border px-4 py-2.5 text-[14px] font-semibold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <div className="flex gap-2">
          {OFFER_KINDS.map((k) => (
            <Chip key={k.id} active={draft.kind === k.id} onClick={() => field('kind')(k.id)}>{k.label}</Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Applies to</span>
            <input
              value={draft.match}
              onChange={(e) => field('match')(e.target.value)}
              placeholder="pasta"
              aria-label="Applies to"
              className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
          </label>
          <NumberField
            label={draft.kind === 'money' ? 'Amount off' : draft.kind === 'percent' ? 'Per cent off' : 'Buy this many'}
            value={draft.value}
            onChange={field('value')}
            suffix={draft.kind === 'money' ? '£' : draft.kind === 'percent' ? '%' : 'for'}
            step={draft.kind === 'percent' ? 5 : 1}
          />
        </div>
        <input
          value={draft.store}
          onChange={(e) => field('store')(e.target.value)}
          placeholder="Which shop (optional)"
          aria-label="Offer shop"
          className="w-full rounded-2xl border px-4 py-2.5 text-[14px] font-semibold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={add}
          disabled={draft.label.trim().length < 2 || !draft.match.trim()}
          className="press w-full rounded-2xl py-3 text-[14px] font-extrabold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Add offer</span>
        </button>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
          A multibuy of “3 for 2” takes the cheapest of every three matching items off the total.
        </p>
      </Card>
    </div>
  );
}
