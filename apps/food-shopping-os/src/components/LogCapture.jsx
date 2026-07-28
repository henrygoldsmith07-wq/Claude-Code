import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Image, Mic, MicOff, ScanBarcode, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { isBarcode, lookupBarcode, parseVoiceLog, recognisePlate, scanAt, SCANNABLE } from '../lib/foodlog.js';
import { buildEntry, mealForTime, scale, timeStamp } from '../lib/nutrition.js';
import { Card, Chip, Pill } from './ui.jsx';
import { Glyph } from './icons.jsx';
import { MealPicker } from './FoodDetail.jsx';

const PrimaryButton = ({ children, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="press w-full rounded-2xl py-3.5 text-[15px] font-extrabold disabled:opacity-40"
    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
  >
    {children}
  </button>
);

/* ---------- Barcode ---------- */

/**
 * Barcode scanner. There is no camera stream in this offline build, so the
 * viewfinder resolves against the bundled branded catalogue — and the manual
 * field takes a real 8/12/13-digit code either way.
 */
export function BarcodeScanner({ defaultMeal, onPick, onCreateCustom }) {
  const [phase, setPhase] = useState('idle'); // idle | scanning | found | unknown
  const [food, setFood] = useState(null);
  const [code, setCode] = useState('');
  const scans = useRef(0);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const scan = () => {
    setPhase('scanning');
    timer.current = setTimeout(() => {
      scans.current += 1;
      const hit = scanAt(scans.current * 7 + new Date().getMinutes());
      setFood(hit);
      setCode(hit.barcode);
      setPhase('found');
      navigator.vibrate?.(60);
    }, 1100);
  };

  const lookup = (value) => {
    setCode(value);
    if (!isBarcode(value)) return setPhase('idle');
    const hit = lookupBarcode(value);
    setFood(hit);
    setPhase(hit ? 'found' : 'unknown');
  };

  return (
    <div className="px-5 pb-10 space-y-4">
      {/* Viewfinder */}
      <div
        className="relative overflow-hidden rounded-3xl border flex items-center justify-center"
        style={{ height: 210, background: 'var(--card-2)', borderColor: 'var(--line)' }}
      >
        <div className="absolute inset-x-10 inset-y-12 rounded-2xl border-2" style={{ borderColor: 'var(--ink-3)' }} />
        {phase === 'scanning' && (
          <div className="scanline absolute inset-x-10 h-0.5" style={{ background: 'var(--accent)' }} />
        )}
        <div className="relative text-center px-8">
          <ScanBarcode size={34} strokeWidth={1.4} style={{ color: 'var(--muted)' }} />
          <p className="mt-2 text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>
            {phase === 'scanning' ? 'Reading barcode…' : 'Hold the barcode inside the frame'}
          </p>
        </div>
      </div>

      <PrimaryButton onClick={scan} disabled={phase === 'scanning'}>
        <span className="inline-flex items-center gap-2"><Camera size={16} /> {phase === 'scanning' ? 'Scanning…' : 'Scan a barcode'}</span>
      </PrimaryButton>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Or type the number</span>
        <input
          value={code}
          onChange={(e) => lookup(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="5000108000015"
          aria-label="Barcode number"
          className="mt-1 w-full rounded-2xl border px-4 py-3 text-[15px] font-bold tabular-nums outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
      </label>

      {phase === 'found' && food && (
        <Card className="rise">
          <div className="flex items-center gap-3">
            <Glyph e={food.emoji} size={22} style={{ color: 'var(--muted)' }} />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-[15px] truncate">{food.name}</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                {food.brand} · {food.per100.kcal} kcal / 100 {food.unit}
              </p>
            </div>
            <Pill tone="good"><Check size={11} strokeWidth={3} /> Matched</Pill>
          </div>
          <div className="mt-3">
            <PrimaryButton onClick={() => onPick(food)}>Choose portion</PrimaryButton>
          </div>
        </Card>
      )}

      {phase === 'unknown' && (
        <Card className="rise">
          <p className="font-extrabold text-[15px]">No product for {code}</p>
          <p className="mt-1 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            Add it once as a custom food and the barcode search will find it next time.
          </p>
          <button
            onClick={onCreateCustom}
            className="press mt-3 w-full rounded-2xl border py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Create a custom food
          </button>
        </Card>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
          Barcodes in this demo catalogue
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {SCANNABLE.map((f) => (
            <Chip key={f.id} onClick={() => lookup(f.barcode)}>{f.brand ? `${f.brand} ` : ''}{f.name}</Chip>
          ))}
        </div>
      </div>
      <p className="text-[11.5px] font-semibold text-center" style={{ color: 'var(--faint)' }}>
        Logging to {defaultMeal}
      </p>
    </div>
  );
}

/* ---------- Photo ---------- */

const ItemRow = ({ item, onGrams, onRemove }) => {
  const macros = scale(item.food.per100, item.grams);
  return (
    <div className="flex items-center gap-3 p-3" style={{ borderColor: 'var(--line)' }}>
      <Glyph e={item.food.emoji} size={20} style={{ color: 'var(--muted)' }} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[14px] truncate">{item.food.name}</p>
        <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          {macros.kcal} kcal · {macros.protein}g protein
          {item.confidence ? ` · ${item.confidence}% sure` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min="0"
          step="10"
          value={item.grams}
          onChange={(e) => onGrams(Math.max(0, Number(e.target.value) || 0))}
          aria-label={`Grams of ${item.food.name}`}
          className="w-16 rounded-xl border px-2 py-1.5 text-[13px] font-bold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <span className="text-[11px] font-bold" style={{ color: 'var(--faint)' }}>{item.food.unit}</span>
        <button onClick={onRemove} aria-label="Remove" className="press p-1" style={{ color: 'var(--faint)' }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

/** AI photo recognition: point at the plate, correct the portions, log it. */
export function PhotoRecognise({ defaultMeal, onDone }) {
  const app = useApp();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [meal, setMeal] = useState(defaultMeal || mealForTime());
  const fileRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const analyse = (seed, url) => {
    setPreview(url);
    setBusy(true);
    setTimeout(() => {
      setItems(recognisePlate(seed, app.catalogue));
      setBusy(false);
    }, 1200);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    analyse(`${file.name}-${file.size}`, URL.createObjectURL(file));
  };

  const log = () => {
    app.logEntries(items.map((i) => buildEntry(i.food, {
      grams: i.grams, meal, time: timeStamp(), source: 'photo',
      servingLabel: `${i.grams} ${i.food.unit}`,
    })));
    onDone();
  };

  const total = items.reduce((sum, i) => sum + scale(i.food.per100, i.grams).kcal, 0);

  return (
    <div className="px-5 pb-10 space-y-4">
      <div
        className="relative overflow-hidden rounded-3xl border flex items-center justify-center"
        style={{ height: 200, background: 'var(--card-2)', borderColor: 'var(--line)' }}
      >
        {preview
          ? <img src={preview} alt="Your meal" className="h-full w-full object-cover" />
          : <div className="text-center px-8">
              <Camera size={34} strokeWidth={1.4} style={{ color: 'var(--muted)' }} />
              <p className="mt-2 text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>Snap the plate before you eat it</p>
            </div>}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}>
            <p className="inline-flex items-center gap-2 text-[13px] font-extrabold">
              <Sparkles size={15} className="pulse-dot" /> Recognising your meal…
            </p>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => fileRef.current?.click()}
          className="press rounded-2xl py-3 text-[14px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-1.5"><Image size={15} /> Choose photo</span>
        </button>
        <button
          onClick={() => analyse(`sample-${Date.now() % 8}`, null)}
          className="press rounded-2xl border py-3 text-[14px] font-extrabold"
          style={{ borderColor: 'var(--line)' }}
        >
          Try a sample plate
        </button>
      </div>

      {/* The shape of the answer, while the answer is being worked out — so
          the page doesn't jump the moment it lands. */}
      {busy && items.length === 0 && (
        <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="skeleton h-9 w-9 rounded-xl shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="skeleton h-3 rounded" style={{ width: `${70 - i * 12}%` }} />
                <div className="skeleton h-2.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </Card>
      )}

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Detected · adjust anything
            </p>
            <Pill tone="accent">{total} kcal</Pill>
          </div>
          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            {items.map((item, i) => (
              <ItemRow
                key={item.food.id}
                item={item}
                onGrams={(g) => setItems((list) => list.map((x, j) => (j === i ? { ...x, grams: g } : x)))}
                onRemove={() => setItems((list) => list.filter((_, j) => j !== i))}
              />
            ))}
          </Card>
          <MealPicker value={meal} onChange={setMeal} />
          <PrimaryButton onClick={log}>Log {items.length} items · {total} kcal</PrimaryButton>
        </>
      )}
      <p className="text-[11.5px] font-semibold text-center" style={{ color: 'var(--faint)' }}>
        Recognition runs on-device against the bundled food catalogue.
      </p>
    </div>
  );
}

/* ---------- Voice ---------- */

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

/** Say what you ate; the parser splits it into portions you can correct. */
export function VoiceLog({ defaultMeal, onDone }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [meal, setMeal] = useState(defaultMeal || mealForTime());
  const recogniser = useRef(null);

  useEffect(() => () => recogniser.current?.stop?.(), []);

  const toggleMic = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recogniser.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setText(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogniser.current = rec;
    rec.start();
    setListening(true);
  };

  const parse = () => {
    const result = parseVoiceLog(text, app.catalogue);
    setParsed(result);
    setMeal(result.meal);
  };

  const log = () => {
    const entries = parsed.items.filter((i) => i.entry).map((i) => ({ ...i.entry, meal }));
    app.logEntries(entries);
    onDone();
  };

  const matched = parsed?.items.filter((i) => i.entry) || [];

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card className="text-center">
        <button
          onClick={toggleMic}
          disabled={!SpeechRecognition}
          className="press mx-auto flex h-20 w-20 items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: listening ? 'var(--accent)' : 'var(--card-2)', color: listening ? 'var(--on-accent)' : 'var(--muted)' }}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
        >
          {listening ? <MicOff size={28} /> : <Mic size={28} className={listening ? 'pulse-dot' : ''} />}
        </button>
        <p className="mt-3 text-[13px] font-bold">
          {listening ? 'Listening — say what you ate' : SpeechRecognition ? 'Tap and talk' : 'Voice input unavailable — type it instead'}
        </p>
        <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
          “two slices of wholemeal bread, 200g greek yogurt and a banana for breakfast”
        </p>
      </Card>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="…or type it here"
        aria-label="What you ate"
        className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none resize-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />

      <PrimaryButton onClick={parse} disabled={!text.trim()}>
        <span className="inline-flex items-center gap-2"><Sparkles size={16} /> Break it into foods</span>
      </PrimaryButton>

      {parsed && (
        <>
          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            {parsed.items.map((item, i) => (
              item.entry ? (
                <ItemRow
                  key={`${item.query}-${i}`}
                  item={{ food: item.food, grams: item.entry.grams }}
                  onGrams={(g) => setParsed((p) => ({
                    ...p,
                    items: p.items.map((x, j) => (j === i
                      ? { ...x, entry: { ...x.entry, grams: g, servingLabel: `${g} ${x.food.unit}` } }
                      : x)),
                  }))}
                  onRemove={() => setParsed((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                />
              ) : (
                <div key={`${item.query}-${i}`} className="flex items-center gap-3 p-3">
                  <X size={16} style={{ color: 'var(--faint)' }} />
                  <p className="flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>“{item.text}”</p>
                  <Pill tone="warn">No match</Pill>
                </div>
              )
            ))}
            {parsed.items.length === 0 && (
              <p className="p-6 text-center text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                Nothing recognisable in there yet.
              </p>
            )}
          </Card>
          <MealPicker value={meal} onChange={setMeal} />
          <PrimaryButton onClick={log} disabled={!matched.length}>
            Log {matched.length} item{matched.length === 1 ? '' : 's'}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
