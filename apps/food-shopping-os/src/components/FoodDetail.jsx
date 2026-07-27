import { useMemo, useState } from 'react';
import { Check, Heart, Scale, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { cx } from '../lib/utils.js';
import { MEALS, entryMacros, mealForTime, scale, servingOptions, timeStamp } from '../lib/nutrition.js';
import { Card, Chip, Pill, Stepper } from './ui.jsx';
import { Glyph } from './icons.jsx';

/* ---------- Shared bits reused by the other logging surfaces ---------- */

export const MealPicker = ({ value, onChange }) => (
  <div className="flex gap-2 overflow-x-auto no-scrollbar">
    {MEALS.map((m) => (
      <Chip key={m.key} active={value === m.key} onClick={() => onChange(m.key)}>{m.label}</Chip>
    ))}
  </div>
);

export const MacroSummary = ({ macros, size = 'lg' }) => (
  <div className="flex items-end justify-between">
    <div>
      <p className={cx('font-extrabold leading-none', size === 'lg' ? 'text-[34px]' : 'text-[22px]')}>
        {macros.kcal.toLocaleString()}
      </p>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>kcal</p>
    </div>
    <div className="flex gap-4 text-right">
      {[['Protein', macros.protein], ['Carbs', macros.carbs], ['Fat', macros.fat]].map(([label, v]) => (
        <div key={label}>
          <p className="text-[15px] font-extrabold leading-none">{v}g</p>
          <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
        </div>
      ))}
    </div>
  </div>
);

export const NumberField = ({ label, value, onChange, suffix, step = 1, min = 0 }) => (
  <label className="block">
    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</span>
    <div className="mt-1 flex items-center gap-1 rounded-2xl border px-3 py-2.5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[15px] font-bold outline-none"
        style={{ color: 'var(--ink)' }}
      />
      {suffix && <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--faint)' }}>{suffix}</span>}
    </div>
  </label>
);

/* ---------- Portion editor ---------- */

/**
 * One screen for "how much of this, and when". Handles both a new log and an
 * edit of something already in the diary; weight-based foods scale from their
 * per-100 profile, quick-adds expose their calories directly.
 */
export default function FoodDetail({ food, entry, defaultMeal, onSave, onDelete }) {
  const app = useApp();
  const source = food || (entry && { ...entry, id: entry.foodId, servings: [] });
  const isQuick = !source?.per100;

  const options = useMemo(
    () => (isQuick ? [] : servingOptions(source, entry?.grams)),
    [source, entry, isQuick],
  );

  const startGrams = entry?.grams ?? options[0]?.grams ?? 100;
  const [grams, setGrams] = useState(startGrams);
  const [qty, setQty] = useState(1);
  const [servingIdx, setServingIdx] = useState(() => {
    const i = options.findIndex((o) => Math.abs(o.grams - startGrams) < 0.01);
    return i >= 0 ? i : 0;
  });
  const [meal, setMeal] = useState(entry?.meal || defaultMeal || mealForTime());
  const [time, setTime] = useState(entry?.time || timeStamp());
  const [quick, setQuick] = useState(() => ({ ...(entry?.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 }) }));

  const unit = source?.unit || 'g';
  const fav = app.favouriteFoods.includes(source?.id);

  const macros = isQuick
    ? { ...entryMacros({ nutrients: quick }) }
    : scale(source.per100, grams);

  const pickServing = (i) => {
    setServingIdx(i);
    setQty(1);
    setGrams(options[i].grams);
  };
  const changeQty = (next) => {
    setQty(next);
    setGrams(+(options[servingIdx].grams * next).toFixed(1));
  };
  const typeWeight = (v) => {
    const g = Math.max(0, Number(v) || 0);
    setGrams(g);
    setQty(1);
    const i = options.findIndex((o) => Math.abs(o.grams - g) < 0.01);
    setServingIdx(i >= 0 ? i : -1);
  };

  const save = () => {
    const servingLabel = servingIdx >= 0
      ? (qty === 1 ? options[servingIdx].label : `${qty} × ${options[servingIdx].label}`)
      : `${grams} ${unit}`;
    onSave(isQuick
      ? { meal, time, nutrients: { ...quick, kcal: Number(quick.kcal) || 0, fibre: 0 } }
      : { grams, meal, time, servingLabel });
  };

  if (!source) return null;

  return (
    <div className="px-5 pb-8 space-y-4">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--card-2)', color: 'var(--muted)' }}>
          <Glyph e={source.emoji} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-[17px] leading-tight">{source.name}</p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            {source.brand || 'Generic'}{!isQuick && ` · ${source.per100.kcal} kcal / 100 ${unit}`}
          </p>
        </div>
        {source.id && !isQuick && (
          <button
            onClick={() => app.toggleFavouriteFood(source.id)}
            aria-label="Favourite food"
            className="press flex h-9 w-9 items-center justify-center rounded-full border shrink-0"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: fav ? 'var(--ink)' : 'var(--faint)' }}
          >
            <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Live nutrition for the chosen portion */}
      <Card>
        <MacroSummary macros={macros} />
        {!isQuick && (
          <p className="mt-3 pt-3 border-t text-[12px] font-semibold" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {grams} {unit} · fibre {macros.fibre}g
          </p>
        )}
      </Card>

      {isQuick ? (
        <div className="grid grid-cols-2 gap-2.5">
          <NumberField label="Calories" value={quick.kcal} onChange={(v) => setQuick((q) => ({ ...q, kcal: v }))} suffix="kcal" step={10} />
          <NumberField label="Protein" value={quick.protein} onChange={(v) => setQuick((q) => ({ ...q, protein: v }))} suffix="g" />
          <NumberField label="Carbs" value={quick.carbs} onChange={(v) => setQuick((q) => ({ ...q, carbs: v }))} suffix="g" />
          <NumberField label="Fat" value={quick.fat} onChange={(v) => setQuick((q) => ({ ...q, fat: v }))} suffix="g" />
        </div>
      ) : (
        <>
          {/* Serving sizes */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Serving size</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {options.map((o, i) => (
                <Chip key={o.label} active={i === servingIdx} onClick={() => pickServing(i)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          {/* Quantity + weight */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>How many</p>
              <Stepper value={qty} onChange={changeQty} min={1} max={10} />
            </div>
            <div className="w-[46%]">
              <NumberField
                label={<span>Weigh it</span>}
                value={grams}
                onChange={typeWeight}
                suffix={unit}
                step={5}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Scale size={13} style={{ color: 'var(--faint)' }} />
            <input
              type="range"
              min="5"
              max={Math.max(600, Math.round(startGrams * 3))}
              step="5"
              value={grams}
              onChange={(e) => typeWeight(e.target.value)}
              aria-label="Portion weight"
              className="w-full accent-current"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        </>
      )}

      {/* Meal + timing */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Meal</p>
        <MealPicker value={meal} onChange={setMeal} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[13px] font-bold">Time eaten</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time eaten"
            className="rounded-2xl border px-3 py-2 text-[14px] font-bold outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        {onDelete && (
          <button
            onClick={onDelete}
            className="press rounded-2xl border px-4 py-3.5 font-extrabold"
            style={{ borderColor: 'var(--line)', color: 'var(--danger)' }}
            aria-label="Delete entry"
          >
            <Trash2 size={17} />
          </button>
        )}
        <button
          onClick={save}
          className="press flex-1 rounded-2xl py-3.5 text-[15px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-2">
            <Check size={16} strokeWidth={3} />
            {entry ? 'Save changes' : `Add ${macros.kcal} kcal to ${MEALS.find((m) => m.key === meal).label}`}
          </span>
        </button>
      </div>

      {!entry && (
        <p className="text-center">
          <Pill tone="faint">Logged foods appear in Recent for one-tap re-logging</Pill>
        </p>
      )}
    </div>
  );
}
