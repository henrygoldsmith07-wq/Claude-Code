import { useMemo, useState } from 'react';
import { Check, ChevronRight, Info, ShoppingCart, Sparkles, X, Zap } from 'lucide-react';
import { gbp } from '../lib/utils.js';
import { buildPlan } from '../lib/planner.js';
import { useApp } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { byId, forMeal, RECIPES } from '../data/recipes.js';
import {
  MEAL_SLOTS, PLANNER_SCOPES, PLANNER_OCCASIONS, WEEK_DAYS,
} from '../data/plan.js';
import { itemsFromRecipes } from '../data/stores.js';
import { planCost, plannedMeals, weekDates } from '../lib/kitchen.js';
import { filterByDiet } from '../lib/goals.js';
import { Section, Card, Chip, Pill, Stepper, FoodArt, Sheet } from './ui.jsx';

/**
 * Pick a recipe for one slot. Defaults to dishes for that meal — breakfasts for
 * a breakfast slot — filtered by your dietary patterns, favourites first.
 */
function RecipePicker({ slot, onPick, onClear, hasMeal }) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [anyMeal, setAnyMeal] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = anyMeal || q ? RECIPES : forMeal(slot);
    const matched = q
      ? pool.filter((r) => r.name.toLowerCase().includes(q)
        || r.cuisine.toLowerCase().includes(q)
        || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))
      : pool;
    return filterByDiet(matched, app.diets)
      .sort((a, b) => Number(app.favourites.includes(b.id)) - Number(app.favourites.includes(a.id)));
  }, [query, anyMeal, slot, app.favourites, app.diets]);

  return (
    <div className="px-5 pb-10 space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${RECIPES.length} recipes…`}
        aria-label="Search recipes"
        className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          {list.length} {anyMeal || query ? 'recipes' : `${slot} recipes`}
          {app.diets.length ? ' that fit your diet' : ''}
        </p>
        <Chip active={!anyMeal} onClick={() => setAnyMeal((v) => !v)}>
          {`Just ${slot}`}
        </Chip>
      </div>
      {hasMeal && (
        <button
          onClick={onClear}
          className="press w-full rounded-2xl border py-2.5 text-[13px] font-extrabold"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1.5"><X size={14} /> Clear this slot</span>
        </button>
      )}
      <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
        {list.slice(0, 120).map((r) => (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            className="press flex w-full items-center gap-3 p-3 text-left"
            style={{ borderColor: 'var(--line)' }}
          >
            <Glyph e={r.emoji} size={20} style={{ color: 'var(--muted)' }} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-[14px] truncate">{r.name}</span>
              <span className="block text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                {r.time} min · {gbp(r.costPerServing, { always: true })}/serving · {r.protein}g protein
              </span>
            </span>
            {app.favourites.includes(r.id) && <Pill tone="accent">Favourite</Pill>}
          </button>
        ))}
      </Card>
    </div>
  );
}

export default function PlanTab({ openRecipe }) {
  const app = useApp();
  const [scope, setScope] = useState('A week');
  const [people, setPeople] = useState(app.household || 1);
  const [budget, setBudget] = useState(2.5);
  const [occasion, setOccasion] = useState('Everyday');
  const [quick, setQuick] = useState(false);
  const [seed, setSeed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [addedToList, setAddedToList] = useState(false);
  const [picking, setPicking] = useState(null); // {date, slot}
  const [showGenerator, setShowGenerator] = useState(false);

  const dates = useMemo(() => weekDates(app.day), [app.day]);
  const planned = plannedMeals(app.plan);

  const plan = useMemo(() => {
    if (!seed) return null;
    return buildPlan(
      { scope, diets: app.diets, goal: app.goal, budget, maxTime: quick ? 30 : null, occasion, people },
      seed,
    );
  }, [seed, scope, app.diets, app.goal, budget, quick, occasion, people]);
  const generated = plan?.meals ?? null;

  const generate = () => {
    setGenerating(true);
    setAddedToList(false);
    setTimeout(() => {
      setSeed(Date.now() % 100000);
      setGenerating(false);
    }, 500);
  };

  /** Drop a generated set into the week: dinners for a week, today for less. */
  const applyGenerated = () => {
    if (!generated) return;
    if (scope === 'A week') {
      dates.forEach((date, i) => generated[i] && app.setPlanSlot(date, 'dinner', generated[i].id));
    } else if (scope === 'A day') {
      ['breakfast', 'lunch', 'dinner'].forEach((slot, i) => generated[i] && app.setPlanSlot(app.day, slot, generated[i].id));
    } else {
      app.setPlanSlot(app.day, 'dinner', generated[0].id);
    }
    setShowGenerator(false);
  };

  const addAllToList = () => {
    app.addToList(itemsFromRecipes([...new Set(generated)], app.pantry.map((p) => p.name)));
    setAddedToList(true);
  };

  const weekRecipes = dates
    .flatMap((d) => Object.values(app.plan[d] || {}))
    .map((id) => byId(id))
    .filter(Boolean);
  const weekCost = weekRecipes.reduce((s, r) => s + r.costPerServing * people, 0);

  const genCost = generated ? generated.reduce((s, r) => s + r.costPerServing * people, 0) : 0;
  const genKcal = generated ? Math.round(generated.reduce((s, r) => s + r.kcal, 0) / generated.length) : 0;

  return (
    <div className="pb-6 space-y-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Meal planner</h1>
        <p className="text-[13.5px] font-semibold rise rise-1" style={{ color: 'var(--muted)' }}>
          {planned
            ? `${planned} meal${planned === 1 ? '' : 's'} planned · about ${gbp(weekCost, { always: true })} for ${people} this week`
            : 'Tap any slot to plan a meal, or let the generator fill the week.'}
        </p>
      </div>

      {/* This week's grid — the plan itself */}
      <Section title="This week" className="rise rise-1" action={planned ? 'Clear week' : undefined} onAction={() => app.clearPlanWeek(dates)}>
        <div className="space-y-2.5">
          {dates.map((date, i) => {
            const slots = app.plan[date] || {};
            const isToday = date === app.day;
            return (
              <Card key={date} className="!p-3" style={isToday ? { borderColor: 'var(--accent)' } : undefined}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-extrabold text-[14px]">
                    {WEEK_DAYS[i]}
                    {isToday && <span className="ml-2 text-[11px] font-bold" style={{ color: 'var(--accent)' }}>Today</span>}
                  </p>
                  {planCost(slots) > 0 && <Pill tone="muted">{gbp(planCost(slots), { always: true })}/person</Pill>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MEAL_SLOTS.map(({ key, label }) => {
                    const recipe = slots[key] ? byId(slots[key]) : null;
                    return recipe ? (
                      <button
                        key={key}
                        onClick={() => setPicking({ date, slot: key })}
                        className="press rounded-xl p-2 text-left"
                        style={{ background: 'var(--card-2)' }}
                      >
                        <Glyph e={recipe.emoji} size={18} style={{ color: 'var(--muted)' }} />
                        <p className="mt-1 text-[11px] font-bold leading-tight line-clamp-2">{recipe.name}</p>
                      </button>
                    ) : (
                      <button
                        key={key}
                        onClick={() => setPicking({ date, slot: key })}
                        className="press rounded-xl p-2 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold min-h-[60px]"
                        style={{ background: 'var(--card-2)', color: 'var(--faint)' }}
                      >
                        + {label}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
        {weekRecipes.length > 0 && (
          <button
            onClick={() => { app.addToList(itemsFromRecipes([...new Set(weekRecipes)], app.pantry.map((p) => p.name))); setAddedToList(true); }}
            className="press mt-3 w-full rounded-2xl border py-3 text-[14px] font-extrabold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingCart size={15} /> Send this week's ingredients to the list
            </span>
          </button>
        )}
      </Section>

      {/* Generator */}
      <Section className="rise rise-2">
        <button
          onClick={() => setShowGenerator((v) => !v)}
          className="press w-full rounded-2xl border py-3 text-[14px] font-extrabold"
          style={showGenerator ? { borderColor: 'var(--line)' } : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <span className="inline-flex items-center gap-2">
            {showGenerator ? <><X size={15} /> Close generator</> : <><Sparkles size={15} /> Generate a plan for me</>}
          </span>
        </button>
      </Section>

      {showGenerator && (
        <Section className="rise">
          <Card className="space-y-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Generate</p>
              <div className="flex gap-2">
                {PLANNER_SCOPES.map((s) => (
                  <Chip key={s} active={scope === s} onClick={() => setScope(s)}>{s}</Chip>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>People</p>
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
                Change it under Goals &amp; targets in your profile.
              </p>
            </div>

            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Occasion</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                {PLANNER_OCCASIONS.map((o) => <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>{o}</Chip>)}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold flex items-center gap-1.5"><Zap size={14} /> 30 minutes or less</p>
              <Chip active={quick} onClick={() => setQuick(!quick)}>{quick ? 'On' : 'Off'}</Chip>
            </div>

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
                    {gbp(genCost, { always: true })} <span className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>for {people}</span>
                  </p>
                </div>
                <p className="text-[13px] font-bold">{genKcal} kcal avg</p>
              </Card>
              <div className="space-y-2.5">
                {generated.map((r, i) => (
                  <Card key={`${r.id}-${i}`} onClick={() => openRecipe(r)} className="flex items-center gap-3 !p-3">
                    <FoodArt recipe={r} className="h-14 w-14 rounded-xl shrink-0" px={26} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                        {scope === 'A week' ? WEEK_DAYS[i] : scope === 'A day' ? ['Breakfast', 'Lunch', 'Dinner'][i] : 'Suggested'}
                      </p>
                      <p className="font-bold text-[15px] truncate">{r.name}</p>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                        {r.time} min · {gbp(r.costPerServing, { always: true })}/serving
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={applyGenerated}
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
        </Section>
      )}

      <Sheet open={!!picking} onClose={() => setPicking(null)} title="Plan a meal">
        {picking && (
          <RecipePicker
            slot={picking.slot}
            hasMeal={!!(app.plan[picking.date] || {})[picking.slot]}
            onPick={(id) => { app.setPlanSlot(picking.date, picking.slot, id); setPicking(null); }}
            onClear={() => { app.setPlanSlot(picking.date, picking.slot, null); setPicking(null); }}
          />
        )}
      </Sheet>
    </div>
  );
}
