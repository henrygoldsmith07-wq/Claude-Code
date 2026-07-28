import { useMemo, useState } from 'react';
import {
  Check, ChevronRight, Info, Leaf, Package, ShoppingCart, Snowflake, Sparkles, Zap,
} from 'lucide-react';
import { gbp } from '../lib/utils.js';
import { buildPlan, scopeMeals } from '../lib/planner.js';
import { useApp } from '../lib/store.jsx';
import { PLANNER_OCCASIONS, WEEK_DAYS } from '../data/plan.js';
import { itemsFromRecipes } from '../data/stores.js';
import { monthOf, peakNow } from '../data/seasons.js';
import { Card, Chip, Pill, Stepper, FoodArt } from './ui.jsx';

const SCOPES = ['1 meal', 'A day', 'A week', 'A month'];

/**
 * The plan generator.
 *
 * It reads your goal, your dietary patterns (yours and everyone you cook for),
 * your pantry and the month, and returns dishes that satisfy the hard rules and
 * lean towards what you already have and what's at its best right now. Applying
 * it writes real dates into the plan.
 */
export default function PlanGenerator({ weekDates, monthDates, openRecipe, onApplied }) {
  const app = useApp();
  const [scope, setScope] = useState('A week');
  const [people, setPeople] = useState(Math.max(1, Math.round(app.portions)));
  const [budget, setBudget] = useState(2.5);
  const [occasion, setOccasion] = useState('Everyday');
  const [quick, setQuick] = useState(false);
  const [batch, setBatch] = useState(false);
  const [usePantry, setUsePantry] = useState(true);
  const [seasonal, setSeasonal] = useState(true);
  const [seed, setSeed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [addedToList, setAddedToList] = useState(false);

  const month = monthOf(app.day);
  const dates = scope === 'A month' ? monthDates : weekDates;
  const pantryNames = app.pantry.map((p) => p.name);

  const plan = useMemo(() => {
    if (!seed) return null;
    return buildPlan(
      {
        scope,
        diets: app.planDiets,
        goal: app.goal,
        budget,
        maxTime: quick ? 30 : null,
        occasion,
        people,
        batch,
        pantry: usePantry ? pantryNames : [],
        month: seasonal ? month : null,
        days: scope === 'A month' ? monthDates.length : null,
        recipes: app.safeRecipes,
      },
      seed,
    );
    // pantryNames is rebuilt every render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, scope, app.planDiets, app.goal, app.safeRecipes, budget, quick, occasion, people, batch, usePantry, seasonal, month, monthDates.length]);

  const generated = plan?.meals ?? null;

  const generate = () => {
    setGenerating(true);
    setAddedToList(false);
    setTimeout(() => {
      setSeed(Date.now() % 100000);
      setGenerating(false);
    }, 500);
  };

  /** Turn the generated run into dated slots. */
  const entries = useMemo(() => {
    if (!generated) return [];
    if (scope === 'A day') {
      return scopeMeals('A day').map((slot, i) => ({ date: app.day, slot, recipeId: generated[i]?.id }));
    }
    if (scope === '1 meal') return [{ date: app.day, slot: 'dinner', recipeId: generated[0]?.id }];
    return dates.map((date, i) => ({ date, slot: 'dinner', recipeId: generated[i]?.id }));
  }, [generated, scope, dates, app.day]);

  const apply = () => {
    app.applyPlanEntries(entries.filter((e) => e.recipeId));
    onApplied?.();
  };

  const addAllToList = () => {
    app.addToList(itemsFromRecipes([...new Set(generated)], pantryNames));
    setAddedToList(true);
  };

  const cost = generated ? generated.reduce((s, r) => s + r.costPerServing * people, 0) : 0;
  const kcal = generated ? Math.round(generated.reduce((s, r) => s + r.kcal, 0) / generated.length) : 0;
  const distinct = generated ? new Set(generated.map((r) => r.id)).size : 0;

  const labelFor = (i) => {
    if (scope === 'A day') return ['Breakfast', 'Lunch', 'Dinner'][i];
    if (scope === '1 meal') return 'Suggested';
    const date = dates[i];
    return date ? `${WEEK_DAYS[i % 7]} ${Number(date.slice(8, 10))}` : '';
  };

  return (
    <>
      <Card className="space-y-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Generate</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {SCOPES.map((s) => <Chip key={s} active={scope === s} onClick={() => setScope(s)}>{s}</Chip>)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
            People
            {app.members.length > 0 && (
              <span className="ml-1.5 normal-case font-semibold" style={{ color: 'var(--muted)' }}>
                · {app.members.length} in your household
              </span>
            )}
          </p>
          <Stepper value={people} onChange={setPeople} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Budget per serving</p>
            <p className="text-[14px] font-extrabold" style={{ color: 'var(--accent)' }}>{gbp(budget, { always: true })}</p>
          </div>
          <input
            type="range" min="1" max="4" step="0.25" value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--accent)' }}
            aria-label="Budget per serving"
          />
        </div>

        {/* Goal and diet come from your profile — one place, not two */}
        <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Planning for</p>
          <p className="mt-0.5 text-[13.5px] font-bold">{app.goalSummary}</p>
          <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
            {app.planDiets.length > app.diets.length
              ? 'Includes everyone you cook for — change it under Family in your profile.'
              : 'Change it under Goals & targets in your profile.'}
          </p>
        </div>

        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Occasion</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {PLANNER_OCCASIONS.map((o) => <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>{o}</Chip>)}
          </div>
        </div>

        <div className="space-y-2.5">
          {[
            { on: quick, set: setQuick, icon: <Zap size={14} />, label: '30 minutes or less' },
            { on: batch, set: setBatch, icon: <Snowflake size={14} />, label: 'Batch cook — fewer dishes, more portions' },
            { on: usePantry, set: setUsePantry, icon: <Package size={14} />, label: 'Use what I already have' },
            { on: seasonal, set: setSeasonal, icon: <Leaf size={14} />, label: 'Favour what’s in season' },
          ].map(({ on, set, icon, label }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold flex items-center gap-1.5">{icon} {label}</p>
              <Chip active={on} onClick={() => set(!on)}>{on ? 'On' : 'Off'}</Chip>
            </div>
          ))}
        </div>

        {seasonal && (
          <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
            In season now: {peakNow(month, 5).join(' · ')}.
          </p>
        )}

        <button
          onClick={generate}
          disabled={generating}
          className="press w-full rounded-2xl py-3.5 text-[15px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: generating ? 0.7 : 1 }}
        >
          <span className="inline-flex items-center gap-2">
            {!generating && <Sparkles size={16} />}
            {generating ? 'Thinking…' : seed ? 'Regenerate' : 'Generate'}
          </span>
        </button>
      </Card>

      {generating && (
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-2xl" />)}
        </div>
      )}

      {generated && !generating && (
        <div className="mt-3 space-y-3">
          {plan.note && (
            <Card className="!p-3 flex items-start gap-2" style={{ background: 'var(--card-2)' }}>
              <Info size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>{plan.note}</p>
            </Card>
          )}
          <Card className="!p-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Estimated cost</p>
              <p className="text-[18px] font-extrabold">
                {gbp(cost, { always: true })} <span className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>for {people}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold">{kcal} kcal avg</p>
              <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                {distinct} dish{distinct === 1 ? '' : 'es'}
              </p>
            </div>
          </Card>
          <div className="space-y-2.5">
            {generated.map((r, i) => (
              <Card key={`${r.id}-${i}`} onClick={() => openRecipe(r)} className="flex items-center gap-3 !p-3">
                <FoodArt recipe={r} className="h-14 w-14 rounded-xl shrink-0" px={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                    {labelFor(i)}
                  </p>
                  <p className="font-bold text-[15px] truncate">{r.name}</p>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    {r.time} min · {gbp(r.costPerServing, { always: true })}/serving
                  </p>
                </div>
                {usePantry && <PantryPill recipe={r} pantryNames={pantryNames} />}
                <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={apply}
              className="press rounded-2xl py-3 text-[13.5px] font-extrabold"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <span className="inline-flex items-center gap-1.5"><Check size={15} strokeWidth={3} /> Put in my plan</span>
            </button>
            <button
              onClick={addAllToList}
              disabled={addedToList}
              className="press rounded-2xl border py-3 text-[13.5px] font-extrabold disabled:opacity-60"
              style={addedToList ? { borderColor: 'var(--good)', color: 'var(--good)' } : { borderColor: 'var(--line)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShoppingCart size={15} /> {addedToList ? 'On your list' : 'Shop for it'}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** How much of a suggested dish your pantry already covers. */
function PantryPill({ recipe, pantryNames }) {
  const have = pantryNames.filter((n) =>
    recipe.ingredients.some((i) => i.name.toLowerCase().includes(n.toLowerCase())
      || n.toLowerCase().includes(i.name.toLowerCase()))).length;
  if (!have) return null;
  return <Pill tone="good">Have {have}</Pill>;
}
