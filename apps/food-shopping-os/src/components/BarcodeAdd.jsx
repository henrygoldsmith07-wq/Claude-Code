import { useRef, useState } from 'react';
import { Camera, Check, ScanLine } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { isBarcode, lookupBarcode, scanAt, SCANNABLE } from '../lib/foodlog.js';
import { Card, Chip, Pill } from './ui.jsx';
import { Glyph } from './icons.jsx';

/**
 * Scanning a barcode onto the shopping list or into the pantry.
 *
 * There is no camera stream in this offline build and no product API behind
 * it: the viewfinder resolves against the bundled catalogue, and a code it
 * doesn't know is reported as unknown rather than filled in with a guess. You
 * can always type the number in.
 */
export default function BarcodeAdd({ onPick, action = 'Add' }) {
  const app = useApp();
  const [phase, setPhase] = useState('idle'); // idle · scanning · found · unknown
  const [code, setCode] = useState('');
  const [food, setFood] = useState(null);
  const [added, setAdded] = useState(null);
  const scans = useRef(0);

  const resolve = (value) => {
    const hit = lookupBarcode(value, app.catalogue);
    setCode(value);
    setFood(hit);
    setPhase(hit ? 'found' : 'unknown');
  };

  const scan = () => {
    setPhase('scanning');
    setAdded(null);
    setTimeout(() => {
      scans.current += 1;
      resolve(scanAt(scans.current * 7 + new Date().getMinutes()).barcode);
    }, 700);
  };

  const take = (item) => {
    onPick(item);
    setAdded(item.name);
    setPhase('idle');
    setFood(null);
    setCode('');
  };

  return (
    <div className="space-y-3">
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border"
        style={{ background: 'var(--card-2)', borderColor: 'var(--line)' }}
      >
        <div className="absolute inset-x-10 inset-y-12 rounded-xl border-2" style={{ borderColor: 'var(--accent)' }} />
        {phase === 'scanning' && <div className="scanline absolute inset-x-10 h-0.5" style={{ background: 'var(--accent)' }} />}
        <p className="relative text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>
          {phase === 'scanning' ? 'Reading barcode…' : 'Hold the barcode inside the frame'}
        </p>
      </div>

      <button
        onClick={scan}
        disabled={phase === 'scanning'}
        className="press w-full rounded-2xl py-3 text-[14px] font-extrabold disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        <span className="inline-flex items-center gap-2">
          <Camera size={15} /> {phase === 'scanning' ? 'Scanning…' : 'Scan a barcode'}
        </span>
      </button>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && isBarcode(code) && resolve(code)}
          placeholder="…or type the number"
          aria-label="Barcode number"
          inputMode="numeric"
          className="min-w-0 flex-1 rounded-2xl border px-4 py-2.5 text-[14px] font-semibold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => resolve(code)}
          disabled={!isBarcode(code)}
          className="press rounded-2xl border px-4 text-[13px] font-extrabold disabled:opacity-40"
          style={{ borderColor: 'var(--line)' }}
        >
          <ScanLine size={15} />
        </button>
      </div>

      {added && (
        <p className="text-center"><Pill tone="good"><Check size={11} strokeWidth={3} /> {added} added</Pill></p>
      )}

      {phase === 'found' && food && (
        <Card className="flex items-center gap-3 !p-3">
          <Glyph e={food.emoji} size={22} style={{ color: 'var(--muted)' }} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[14px] truncate">{food.name}</p>
            <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
              {[food.brand, code].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            onClick={() => take({ name: food.brand ? `${food.brand} ${food.name}` : food.name, emoji: food.emoji, barcode: code })}
            className="press rounded-full px-3 py-1.5 text-[12.5px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {action}
          </button>
        </Card>
      )}

      {phase === 'unknown' && (
        <Card className="!p-3">
          <p className="font-bold text-[13.5px]">Barcode {code} isn’t in the catalogue</p>
          <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            Nothing is invented for an unknown code. Add it by name instead and it’ll be yours from then on.
          </p>
          <button
            onClick={() => take({ name: `Item ${code.slice(-4)}`, barcode: code })}
            className="press mt-2 w-full rounded-2xl border py-2 text-[12.5px] font-extrabold"
            style={{ borderColor: 'var(--line)' }}
          >
            {action} it as an unnamed item
          </button>
        </Card>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>
          Barcodes this build can read
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {SCANNABLE.slice(0, 8).map((f) => (
            <Chip key={f.id} onClick={() => resolve(f.barcode)}>{f.brand ? `${f.brand} ` : ''}{f.name}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
