import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { gbp, cx } from '../lib/utils.js';
import { Card, Ring, Pill, FoodArt, Meter } from './ui.jsx';

const fmtTime = (mins) => (mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`);

/** Live countdown used inside cooking mode steps. */
function Timer({ mins }) {
  const [left, setLeft] = useState(mins * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const done = left === 0;
  return (
    <button
      onClick={() => (done ? setLeft(mins * 60) : setRunning(!running))}
      className="press mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-extrabold tabular-nums"
      style={done
        ? { background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }
        : running
          ? { background: 'var(--accent)', color: 'var(--on-accent)' }
          : { background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}
    >
      {done ? '✓ Done — reset' : `${running ? '⏸' : '▶'} ${mm}:${ss}`}
    </button>
  );
}

export default function RecipeDetail({ recipe, onClose }) {
  const app = useApp();
  const [cooking, setCooking] = useState(false);
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const fav = app.favourites.includes(recipe.id);
  const havePantry = recipe.ingredients.filter((i) => i.pantry).length;

  const finish = () => {
    app.completeRecipe(recipe);
    setFinished(true);
  };

  /* ---------- Cooking mode (fullscreen step-by-step) ---------- */
  if (cooking) {
    const s = recipe.steps[step];
    const last = step === recipe.steps.length - 1;
    return (
      <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={() => setCooking(false)} className="press text-[13px] font-extrabold" style={{ color: 'var(--muted)' }}>✕ Exit</button>
            <p className="text-[13px] font-extrabold">{recipe.emoji} {recipe.name}</p>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--faint)' }}>{step + 1}/{recipe.steps.length}</span>
          </div>
          <div className="mt-3"><Meter value={step + 1} max={recipe.steps.length} /></div>
        </div>

        {finished ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center rise">
            <p className="text-6xl">🎉</p>
            <h2 className="mt-4 text-[24px] font-extrabold">Chef’s kiss!</h2>
            <p className="mt-2 text-[14.5px] font-semibold" style={{ color: 'var(--muted)' }}>
              +60 XP · streak extended to {app.streak} days.<br />Nutrition logged to today’s totals.
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
              {s.timerMins && s.timerMins <= 90 && <div><Timer mins={s.timerMins} /></div>}
              <p className="mt-6 text-[12.5px] font-semibold" style={{ color: 'var(--faint)' }}>
                🎙️ Voice mode: say “next” or swipe — hands-free.
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
                {last ? '✓ Finish & log meal' : 'Next ›'}
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
        <FoodArt recipe={recipe} className="h-56 w-full" size="text-8xl" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="press absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full font-bold"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#17181a' }}
        >
          ‹
        </button>
        <button
          onClick={() => app.toggleFavourite(recipe.id)}
          aria-label="Favourite"
          className="press absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full text-[16px]"
          style={{ background: 'rgba(255,255,255,0.9)', color: fav ? '#e0245e' : '#6b6f76' }}
        >
          {fav ? '♥' : '♡'}
        </button>
      </div>

      <div className="px-5 -mt-6 relative space-y-4">
        <Card className="rise">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[20px] font-extrabold leading-tight">{recipe.name}</h1>
            <Pill tone="accent">★ {recipe.rating}</Pill>
          </div>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
            {recipe.cuisine} · serves {recipe.servings} · {gbp(recipe.costPerServing, { always: true })}/serving
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="muted">👨‍🍳 {recipe.difficulty}</Pill>
            <Pill tone="muted">🔪 Prep {fmtTime(recipe.prep)}</Pill>
            <Pill tone="muted">🔥 Cook {fmtTime(recipe.time)}</Pill>
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
            ].map(([label, score, icon]) => (
              <div key={label} className="rounded-xl py-2" style={{ background: 'var(--card-2)' }}>
                <p className="text-[15px] font-extrabold">{icon} {score}</p>
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
              🥫 You have {havePantry} of {recipe.ingredients.length}
            </Pill>
          </div>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.name} className="flex items-center justify-between text-[14px]">
                <span className={cx('font-semibold', ing.pantry && 'opacity-60')}>
                  {ing.pantry ? '✅' : '🛒'} {ing.name}
                </span>
                <span className="font-bold text-[13px]" style={{ color: 'var(--muted)' }}>{ing.qty}</span>
              </li>
            ))}
          </ul>
          {havePantry < recipe.ingredients.length && (
            <button className="press mt-3 w-full rounded-2xl py-2.5 text-[13px] font-extrabold border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              Add {recipe.ingredients.length - havePantry} missing to shopping list
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
                  {s.text} {s.timerMins ? <b style={{ color: 'var(--accent)' }}>⏱ {fmtTime(s.timerMins)}</b> : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <button
          onClick={() => { setCooking(true); setStep(0); setFinished(false); }}
          className="press w-full rounded-2xl py-4 text-[16px] font-extrabold rise rise-3"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-lg)' }}
        >
          🍳 Start cooking mode
        </button>
      </div>
    </div>
  );
}
