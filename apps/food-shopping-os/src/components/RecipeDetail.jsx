import { useEffect, useState } from 'react';
import {
  Check, ChefHat, ChevronLeft, Flame, Heart, Mic, PartyPopper, Package,
  Pause, Play, ShoppingCart, Slice, Star, Timer as TimerIcon, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp, cx } from '../lib/utils.js';
import { itemsFromRecipes } from '../data/stores.js';
import { Card, Ring, Pill, FoodArt, Meter } from './ui.jsx';
import { Glyph } from './icons.jsx';

const fmtTime = (mins) => (mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`);

/**
 * Live countdown for a cooking step. State lives in the parent (keyed by step)
 * so navigating between steps never resets a running timer.
 */
function Timer({ mins, state, onChange }) {
  const left = state ? state.left : mins * 60;
  const running = state?.running ?? false;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const done = left === 0;
  return (
    <button
      onClick={() =>
        done
          ? onChange({ left: mins * 60, running: false })
          : onChange({ left, running: !running })}
      className="press mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-extrabold tabular-nums"
      style={done
        ? { background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }
        : running
          ? { background: 'var(--accent)', color: 'var(--on-accent)' }
          : { background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}
    >
      {done
        ? <><Check size={16} strokeWidth={3} /> Done — reset</>
        : <>{running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />} {mm}:{ss}</>}
    </button>
  );
}

export default function RecipeDetail({ recipe, onClose }) {
  const app = useApp();
  const [cooking, setCooking] = useState(false);
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timers, setTimers] = useState({}); // step index -> {left, running}
  const [addedMissing, setAddedMissing] = useState(false);
  const fav = app.favourites.includes(recipe.id);
  const missing = recipe.ingredients.filter((i) => !i.pantry);
  const havePantry = recipe.ingredients.length - missing.length;

  // One interval drives every step timer, so timers survive step navigation.
  useEffect(() => {
    if (!cooking) return;
    const id = setInterval(() => {
      setTimers((t) => {
        let changed = false;
        const next = { ...t };
        for (const k of Object.keys(next)) {
          const v = next[k];
          if (v.running && v.left > 0) {
            const left = v.left - 1;
            next[k] = { left, running: left > 0 };
            if (left === 0) navigator.vibrate?.(300);
            changed = true;
          }
        }
        return changed ? next : t;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooking]);

  const finish = () => {
    app.completeRecipe(recipe);
    setFinished(true);
  };

  const addMissing = () => {
    app.addToList(itemsFromRecipes([recipe]));
    setAddedMissing(true);
  };

  /* ---------- Cooking mode (fullscreen step-by-step) ---------- */
  if (cooking) {
    const s = recipe.steps[step];
    const last = step === recipe.steps.length - 1;
    return (
      <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={() => setCooking(false)} className="press inline-flex items-center gap-1 text-[13px] font-extrabold" style={{ color: 'var(--muted)' }}>
              <X size={14} strokeWidth={2.6} /> Exit
            </button>
            <p className="text-[13px] font-extrabold truncate px-2">{recipe.name}</p>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--faint)' }}>{step + 1}/{recipe.steps.length}</span>
          </div>
          <div className="mt-3"><Meter value={step + 1} max={recipe.steps.length} /></div>
        </div>

        {finished ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center rise">
            <PartyPopper size={56} strokeWidth={1.4} style={{ color: 'var(--accent)' }} />
            <h2 className="mt-4 text-[24px] font-extrabold">Chef’s kiss!</h2>
            <p className="mt-2 text-[14.5px] font-semibold" style={{ color: 'var(--muted)' }}>
              +60 XP · cooking streak: {app.streak} days.<br />Nutrition logged to today’s totals.
            </p>
            <button onClick={onClose} className="press mt-8 rounded-2xl px-8 py-3.5 font-extrabold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              Back to my day
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col justify-center px-7 rise" key={step}>
              <p className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Step {step + 1}</p>
              <p className="mt-3 text-[24px] font-bold leading-snug">{s.text}</p>
              {s.timerMins && s.timerMins <= 90 && (
                <div>
                  <Timer
                    mins={s.timerMins}
                    state={timers[step]}
                    onChange={(v) => setTimers((t) => ({ ...t, [step]: v }))}
                  />
                </div>
              )}
              <p className="mt-6 text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
                <Mic size={13} /> Voice mode: say “next” or swipe — hands-free.
              </p>
            </div>
            <div className="flex gap-3 px-5 pb-8 shrink-0">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="press flex-1 rounded-2xl py-4 font-extrabold disabled:opacity-35"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                ‹ Back
              </button>
              <button
                onClick={() => (last ? finish() : setStep(step + 1))}
                className="press flex-[2] rounded-2xl py-4 font-extrabold"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {last && <Check size={16} strokeWidth={3} />}
                  {last ? 'Finish & log meal' : 'Next ›'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---------- Recipe page ---------- */
  return (
    <div className="pb-8">
      <div className="relative">
        <FoodArt recipe={recipe} className="h-56 w-full" px={64} />
        <button
          onClick={onClose}
          aria-label="Close"
          className="press absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          <ChevronLeft size={18} strokeWidth={2.4} />
        </button>
        <button
          onClick={() => app.toggleFavourite(recipe.id)}
          aria-label="Favourite"
          className="press absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: fav ? 'var(--ink)' : 'var(--faint)' }}
        >
          <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="px-5 -mt-6 relative space-y-4">
        <Card className="rise">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[20px] font-extrabold leading-tight">{recipe.name}</h1>
            <Pill tone="accent"><Star size={11} fill="currentColor" /> {recipe.rating}</Pill>
          </div>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
            {recipe.cuisine} · serves {recipe.servings} · {gbp(recipe.costPerServing, { always: true })}/serving
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="muted"><ChefHat size={12} /> {recipe.difficulty}</Pill>
            <Pill tone="muted"><Slice size={12} /> Prep {fmtTime(recipe.prep)}</Pill>
            <Pill tone="muted"><Flame size={12} /> Cook {fmtTime(recipe.time)}</Pill>
            {recipe.tags.slice(0, 2).map((t) => <Pill key={t} tone="faint">{t}</Pill>)}
          </div>
        </Card>

        {/* Nutrition rings */}
        <Card className="rise rise-1">
          <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--faint)' }}>Per serving</p>
          <div className="flex justify-between">
            <Ring value={recipe.kcal} max={800} size={68} color="var(--series-2)" label={recipe.kcal} sub="kcal" />
            <Ring value={recipe.protein} max={50} size={68} color="var(--series-1)" label={`${recipe.protein}g`} sub="protein" />
            <Ring value={recipe.carbs} max={90} size={68} color="var(--series-3)" label={`${recipe.carbs}g`} sub="carbs" />
            <Ring value={recipe.fat} max={40} size={68} color="var(--accent)" label={`${recipe.fat}g`} sub="fat" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Health', recipe.healthScore, '💚'],
              ['Protein', recipe.proteinScore, '💪'],
              ['Planet', recipe.envScore, '🌍'],
            ].map(([label, score, glyph]) => (
              <div key={label} className="rounded-xl py-2" style={{ background: 'var(--card-2)' }}>
                <p className="text-[15px] font-extrabold inline-flex items-center gap-1.5">
                  <Glyph e={glyph} size={14} style={{ color: 'var(--muted)' }} /> {score}
                </p>
                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label} score</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Ingredients with pantry availability */}
        <Card className="rise rise-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Ingredients</p>
            <Pill tone={havePantry === recipe.ingredients.length ? 'good' : 'accent'}>
              <Package size={12} /> You have {havePantry} of {recipe.ingredients.length}
            </Pill>
          </div>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.name} className="flex items-center justify-between text-[14px]">
                <span className={cx('font-semibold inline-flex items-center gap-2', ing.pantry && 'opacity-60')}>
                  {ing.pantry
                    ? <Check size={14} strokeWidth={3} style={{ color: 'var(--good)' }} />
                    : <ShoppingCart size={14} style={{ color: 'var(--muted)' }} />}
                  {ing.name}
                </span>
                <span className="font-bold text-[13px]" style={{ color: 'var(--muted)' }}>{ing.qty}</span>
              </li>
            ))}
          </ul>
          {missing.length > 0 && (
            <button
              onClick={addMissing}
              disabled={addedMissing}
              className="press mt-3 w-full rounded-2xl py-2.5 text-[13px] font-extrabold border disabled:opacity-60"
              style={addedMissing
                ? { borderColor: 'var(--good)', color: 'var(--good)' }
                : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                {addedMissing
                  ? <><Check size={14} strokeWidth={3} /> Added to your Shop list</>
                  : <>Add {missing.length} missing to shopping list</>}
              </span>
            </button>
          )}
        </Card>

        {/* Steps preview */}
        <Card className="rise rise-3">
          <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--faint)' }}>Method · {recipe.steps.length} steps</p>
          <ol className="space-y-2.5">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[13.5px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>
                  {i + 1}
                </span>
                <span className="font-medium leading-snug" style={{ color: 'var(--muted)' }}>
                  {s.text}{' '}
                  {s.timerMins ? (
                    <b className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                      <TimerIcon size={12} /> {fmtTime(s.timerMins)}
                    </b>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <button
          onClick={() => { setCooking(true); setStep(0); setFinished(false); setTimers({}); }}
          className="press w-full rounded-2xl py-4 text-[16px] font-extrabold rise rise-3"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-lg)' }}
        >
          <span className="inline-flex items-center gap-2"><ChefHat size={18} /> Start cooking mode</span>
        </button>
      </div>
    </div>
  );
}
