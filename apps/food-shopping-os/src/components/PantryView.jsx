import { useMemo, useState } from 'react';
import { Camera, Mic, ReceiptText, ScanBarcode } from 'lucide-react';
import { gbp, expiryStatus } from '../lib/utils.js';
import { Glyph } from './icons.jsx';
import { PANTRY, LOCATIONS, pantryValue, expiringSoon } from '../data/pantry.js';
import { Card, Chip, Pill, Section } from './ui.jsx';

export default function PantryView() {
  const [location, setLocation] = useState('All');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    let list = PANTRY;
    if (location !== 'All') list = list.filter((p) => p.location === location);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.expiryDays - b.expiryDays);
  }, [location, query]);

  const expiring = expiringSoon();

  return (
    <div className="px-5 pb-8 space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [gbp(pantryValue(), { always: true }), 'pantry value'],
          [PANTRY.length, 'items tracked'],
          [expiring.length, 'expiring soon'],
        ].map(([v, label]) => (
          <Card key={label} className="!p-3 text-center">
            <p className="text-[17px] font-extrabold">{v}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
          </Card>
        ))}
      </div>

      {/* Capture methods */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {[[ScanBarcode, 'Scan barcode'], [ReceiptText, 'Scan receipt'], [Mic, 'Voice log'], [Camera, 'Photo shelf']].map(([Icon, label]) => (
          <button key={label} className="press shrink-0 inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-[12.5px] font-bold" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your pantry…"
        className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {['All', ...LOCATIONS].map((loc) => (
          <Chip key={loc} active={location === loc} onClick={() => setLocation(loc)}>{loc}</Chip>
        ))}
      </div>

      {/* Use soon */}
      {location === 'All' && !query && expiring.length > 0 && (
        <Section title="Use soon" className="!px-0">
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5">
            {expiring.map((p) => {
              const st = expiryStatus(p.expiryDays);
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

      {/* Inventory list */}
      <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
        {items.length === 0 && (
          <p className="p-6 text-center text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>Nothing here.</p>
        )}
        {items.map((p) => {
          const st = expiryStatus(p.expiryDays);
          return (
            <div key={p.id} className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--line)' }}>
              <Glyph e={p.emoji} size={22} style={{ color: 'var(--muted)' }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[14px] truncate">{p.name}</p>
                <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                  {p.qty} · {p.location} · {p.store}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-[13px]">{gbp(p.cost, { always: true })}</p>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
            </div>
          );
        })}
      </Card>

      <p className="text-center text-[12px] font-semibold" style={{ color: 'var(--faint)' }}>
        Auto expiry reminders on · low items feed your shopping list
      </p>
    </div>
  );
}
