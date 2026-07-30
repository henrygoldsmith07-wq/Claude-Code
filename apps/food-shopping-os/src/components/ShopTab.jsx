import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, Building2, Check, Copy, MapPin, Mic, Plus, Receipt, RotateCcw, ScanLine, ShoppingCart, Tag,
  Trash2, TrendingUp, TriangleAlert, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { gbp, cx, prettyDate } from '../lib/utils.js';
import { AISLE_ORDER, COMMON_STORES, checkedTotalOf } from '../data/stores.js';
import { groupForStore } from '../lib/shopping.js';
import { haptic } from '../lib/haptics.js';
import ReceiptScan from './ReceiptScan.jsx';
import {
  Section, Card, Empty, Meter, Chip, GestureMenu, Pill, Sheet,
} from './ui.jsx';
import PrimaryAction from './PrimaryAction.jsx';
import PriceCompare from './PriceCompare.jsx';
import { AddItem, FinishShop } from './ShopForms.jsx';
import OffersPanel from './OffersPanel.jsx';
import BarcodeAdd from './BarcodeAdd.jsx';
import BudgetPanel from './BudgetPanel.jsx';
import StoreIntegrations from './StoreIntegrations.jsx';

import ShoppingListRow from './ShoppingListRow.jsx';

/* ---------- Tab ---------- */

export default function ShopTab({ quickAddKey = 0 }) {
  const app = useApp();
  const [view, setView] = useState('list'); // list · history · prices · stores · budget
  const [shoppingMode, setShoppingMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState(null); // finish · offers · scan · export
  const [store, setStore] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    if (quickAddKey) {
      setView('list');
      setAdding(true);
    }
  }, [quickAddKey]);

  const list = app.shoppingList;
  const stores = useMemo(() => [...new Set(app.shops.map((s) => s.store))], [app.shops]);
  const grouped = useMemo(
    () => groupForStore(list, { store, routes: app.storeRoutes, memory: app.aisleMemory }),
    [list, store, app.storeRoutes, app.aisleMemory],
  );

  const basket = app.basket;
  const ticked = list.filter((i) => i.checked).length;
  const checkedTotal = checkedTotalOf(list);
  const known = store && app.storeRoutes[store];

  const asText = () => {
    const lines = grouped.map(([aisle, items]) =>
      `${aisle}\n${items.map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ''}`).join('\n')}`);
    return `Shopping list${store ? ` · ${store}` : ''}\n\n${lines.join('\n\n')}`;
  };

  const voiceAdd = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setVoiceStatus('Voice input is not supported by this browser.'); return; }
    const recognition = new Recognition();
    recognition.lang = 'en-GB';
    recognition.onresult = (event) => {
      const words = event.results[0][0].transcript.trim().replace(/^(add|buy)\s+/i, '');
      if (words) { app.addToList({ name: words }); setVoiceStatus(`Added “${words}”.`); }
    };
    recognition.onerror = () => setVoiceStatus('Could not hear that — try again.');
    recognition.start();
    setVoiceStatus('Listening…');
  };

  if (!app.householdAccess.shopping) {
    return (
      /* The shared header already says "Shop" — a second <h1> here would be
         two page titles on one screen. */
      <div className="pb-6 pt-2">
        <Section>
          <Empty Icon={ShoppingCart} title={`Shopping is off for ${app.activeMember?.name}`}>
            An adult can change this profile’s household permissions from the avatar in the
            top corner, under Household.
          </Empty>
        </Section>
      </div>
    );
  }

  return (
    <div className="pb-6 space-y-6">
      {/* The shared header carries the title now. Five views don't fit a
          320px phone on one line, so this scrolls rather than pushing the
          whole page sideways. */}
      <div className="hero-gradient pt-1 pb-3">
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-5 rise rise-1">
          {[['list', 'List', ShoppingCart], ['history', 'Shops', Receipt], ['prices', 'Prices', TrendingUp], ['stores', 'Stores', Building2], ['budget', 'Budget', Banknote]].map(([k, label, Icon]) => (
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
                  <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                    {shoppingMode ? 'Running total' : 'Estimated basket'}
                  </p>
                  <p className="text-[1.5rem] font-extrabold">
                    {/* Keyed on the value, so a changed total animates in
                        instead of silently swapping under your eyes. */}
                    <span key={shoppingMode ? checkedTotal : basket.projected} className="count-up inline-block">
                      {gbp(shoppingMode ? checkedTotal : basket.projected, { always: true })}
                    </span>
                    {shoppingMode && (
                      <span className="text-[0.8125rem] font-semibold ml-1.5" style={{ color: 'var(--muted)' }}>
                        of {gbp(basket.projected, { always: true })}
                      </span>
                    )}
                  </p>
                  {basket.saved > 0 && (
                    <p className="text-[0.75rem] font-bold" style={{ color: 'var(--good)' }}>
                      {gbp(basket.total, { always: true })} less {gbp(basket.saved, { always: true })} of your offers
                    </p>
                  )}
                  {basket.unpriced > 0 && (
                    <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                      {basket.unpriced} item{basket.unpriced === 1 ? '' : 's'} with no price yet — the total is only what you’ve typed in.
                    </p>
                  )}
                </div>
                {/* Starting a shop is the primary action at the bottom of the
                    screen now; only the way out of it belongs up here. */}
                {shoppingMode && (
                  <button
                    onClick={() => setShoppingMode(false)}
                    className="press rounded-2xl px-4 py-3 text-[0.8125rem] font-extrabold shrink-0"
                    style={{ background: 'var(--card-2)', color: 'var(--ink)' }}
                  >
                    <span className="inline-flex items-center gap-1.5"><X size={14} /> Exit mode</span>
                  </button>
                )}
              </div>

              {app.weeklyBudget > 0 ? (
                <div className="mt-3">
                  <Meter
                    value={basket.spent + (shoppingMode ? checkedTotal : basket.projected)}
                    max={app.weeklyBudget}
                    color={basket.over ? 'var(--warn)' : 'var(--accent)'}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                    <span>{gbp(basket.spent, { always: true })} spent this week</span>
                    <span className="inline-flex items-center gap-1" style={basket.over ? { color: 'var(--warn)', fontWeight: 700 } : {}}>
                      {basket.over && <TriangleAlert size={12} />}
                      {basket.over
                        ? `${gbp(Math.abs(basket.left), { always: true })} over budget`
                        : `${gbp(basket.left, { always: true })} headroom`}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Set a weekly budget in your profile to see headroom here.
                </p>
              )}

              {ticked > 0 && (
                <button
                  onClick={() => setSheet('finish')}
                  className="press mt-3 w-full rounded-2xl border py-2.5 text-[0.8125rem] font-extrabold"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Receipt size={14} /> Finish shop · {ticked} item{ticked === 1 ? '' : 's'}
                  </span>
                </button>
              )}
            </Card>
          </Section>

          {/* Which shop you're walking round: its aisles, in your order */}
          {(stores.length > 0 || list.length > 0) && (
            <Section className="rise rise-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[0.75rem] font-bold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
                  <MapPin size={12} /> Shopping at
                </p>
                {known && <Pill tone="good">your route, learned</Pill>}
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <Chip active={!store} onClick={() => setStore('')}>Any shop</Chip>
                {[...new Set([...stores, ...COMMON_STORES])].slice(0, 8).map((s) => (
                  <Chip key={s} active={store === s} onClick={() => setStore(s)}>{s}</Chip>
                ))}
              </div>
              {store && (
                <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  {known
                    ? `Aisles in the order you walked ${store} last time: ${known.join(' → ')}. Everything else follows the usual order.`
                    : `No route for ${store} yet — tick items off in the order you find them and it'll remember.`}
                </p>
              )}
            </Section>
          )}

          <Section className="rise rise-2">
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              <button
                onClick={() => setAdding((v) => !v)}
                className="press col-span-2 rounded-2xl border py-2.5 text-[0.78125rem] font-extrabold"
                style={adding ? { borderColor: 'var(--line)' } : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {adding ? <><X size={13} /> Close</> : <><Plus size={14} /> Add an item</>}
                </span>
              </button>
              <button
                onClick={() => setSheet('scan')}
                className="press rounded-2xl border py-2.5 text-[0.78125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="inline-flex items-center gap-1.5"><ScanLine size={14} /> Scan</span>
              </button>
              <button
                onClick={() => setSheet('offers')}
                className="press rounded-2xl border py-2.5 text-[0.78125rem] font-extrabold"
                style={{ borderColor: app.offers.length ? 'var(--accent)' : 'var(--line)', color: app.offers.length ? 'var(--accent)' : 'var(--ink)' }}
              >
                <span className="inline-flex items-center gap-1.5"><Tag size={14} /> Offers{app.offers.length ? ` (${app.offers.length})` : ''}</span>
              </button>
              <button
                onClick={voiceAdd}
                className="press rounded-2xl border py-2.5 text-[0.78125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="inline-flex items-center gap-1.5"><Mic size={14} /> Voice</span>
              </button>
              {/* A receipt is about a shop you already did, so it doesn't belong
                  behind a list that has to be full first. */}
              <button
                onClick={() => setSheet('receipt')}
                className="press col-span-2 rounded-2xl border py-2.5 text-[0.78125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="inline-flex items-center gap-1.5"><Receipt size={14} /> Read a receipt</span>
              </button>
            </div>
            {adding && <AddItem onAdd={(item) => app.addToList(item)} />}
            {voiceStatus && <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>{voiceStatus}</p>}
          </Section>

          {app.shops.length > 0 && (
            <Section className="rise rise-2">
              <button
                onClick={() => app.repeatLastShop()}
                className="press w-full rounded-2xl border py-2.5 text-[0.8125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="inline-flex items-center gap-1.5"><RotateCcw size={14} /> Repeat your last shop</span>
              </button>
            </Section>
          )}

          {/* Things you buy again and again, going by your receipts */}
          {app.restock.length > 0 && (
            <Section className="rise rise-2" title="You usually have">
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                {app.restock.map((r) => (
                  <Chip key={r.name} onClick={() => app.addToList({ name: r.name, emoji: r.emoji })}>
                    <span className="inline-flex items-center gap-1.5">
                      <RotateCcw size={11} /> {r.name} · {r.times}×
                    </span>
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {list.length === 0 ? (
            <Section className="rise rise-2">
              <Card className="text-center py-10">
                <ShoppingCart size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
                <p className="font-bold">Nothing on the list yet</p>
                <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Add items here, scan a barcode, send a week's meals over from the planner,
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
                      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: allDone ? 'var(--good)' : 'var(--faint)' }}>
                        {aisle} {allDone && '✓'}
                      </p>
                      <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
                        {items.map((item) => (
                          <ShoppingListRow
                            key={item.id}
                            item={item}
                            onAisle={app.setItemAisle}
                            dragging={dragging}
                            setDragging={setDragging}
                          />
                        ))}
                      </Card>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setSheet('export')}
                className="press mt-3 w-full rounded-2xl border py-2.5 text-[0.8125rem] font-extrabold"
                style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
              >
                <span className="inline-flex items-center gap-1.5"><Copy size={14} /> Copy the list as text</span>
              </button>

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
              <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                Tick items off as you shop, then hit “Finish shop”. Spending, budget streaks,
                price comparison and your route round each shop all come from these.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...app.shops].reverse().map((s) => (
                <Card key={s.id} className="flex items-center justify-between !p-3.5">
                  <div className="min-w-0">
                    <p className="font-bold text-[0.90625rem] truncate">{s.store}</p>
                    <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                      {prettyDate(s.date)} · {s.items.length} item{s.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="font-extrabold text-[1rem] shrink-0">{gbp(s.total, { always: true })}</p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {view === 'prices' && <PriceCompare />}
      {view === 'stores' && <StoreIntegrations />}
      {view === 'budget' && <BudgetPanel />}

      <Sheet open={sheet === 'finish'} onClose={() => setSheet(null)} title="Finish shop">
        <FinishShop items={list} store={store} onDone={() => { setSheet(null); setShoppingMode(false); }} />
      </Sheet>
      <Sheet open={sheet === 'offers'} onClose={() => setSheet(null)} title="Offers you have">
        <OffersPanel />
      </Sheet>
      <Sheet open={sheet === 'scan'} onClose={() => setSheet(null)} title="Scan onto the list">
        <div className="px-5 pb-10">
          <BarcodeAdd action="Add" onPick={(item) => app.addToList(item)} />
        </div>
      </Sheet>
      <Sheet open={sheet === 'receipt'} onClose={() => setSheet(null)} title="Read a receipt">
        <ReceiptScan onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'export'} onClose={() => setSheet(null)} title="Your list as text">
        <div className="px-5 pb-10 space-y-3">
          <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
            Forq doesn’t connect to any supermarket. This is your list as plain text, in the
            aisle order you’d walk — paste it into whichever shop’s app or site you use.
          </p>
          <textarea
            readOnly
            value={asText()}
            rows={12}
            aria-label="List as text"
            className="w-full rounded-2xl border p-3 text-[0.78125rem] font-semibold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            onClick={() => navigator.clipboard?.writeText(asText())}
            className="press w-full rounded-2xl py-3 text-[0.875rem] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <span className="inline-flex items-center gap-1.5"><Copy size={15} /> Copy</span>
          </button>
        </div>
      </Sheet>

      {/* Whichever step of a shop you're actually at. */}
      {view === 'list' && (
        list.length === 0
          ? <PrimaryAction label="Add something to the list" onClick={() => setAdding(true)} />
          : !shoppingMode
            ? <PrimaryAction label="Start shopping" hint={`${list.length} item${list.length === 1 ? '' : 's'}`} onClick={() => setShoppingMode(true)} />
            : <PrimaryAction label="Finish and record this shop" hint={`${ticked}/${list.length} ticked`} onClick={() => setSheet('finish')} />
      )}
    </div>
  );
}
