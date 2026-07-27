import { useMemo, useState } from 'react';
import { Check, ChevronRight, Info, ShoppingCart, Snowflake, Sparkles, Zap } from 'lucide-react';
import { gbp } from '../lib/utils.js';
import { buildPlan } from '../lib/planner.js';
import { useApp } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { byId } from '../data/recipes.js';
import {
  DEFAULT_PLAN, WEEK_DAYS, PLANNER_GOALS, PLANNER_DIETS, PLANNER_SCOPES, PLANNER_OCCASIONS,
  PREP_BATCH, PREP_DEFAULT_DONE,
} from '../data/plan.js';
import { itemsFromRecipes } from '../data/stores.js';
import { Section, Card, Chip, Pill, Stepper, FoodArt, Meter } from './ui.jsx';

export default function PlanTab({ openRecipe }) {
  const app = useApp();
  const [scope, setScope] = useState('A week');
  const [people, setPeople] = useState(2);
  const [budget, setBudget] = useState(2.5);
  const [goal, setGoal] = useState('Balanced');
  const [diet, setDiet] = useState('None');
  const [occasion, setOccasion] = useState('Everyday');
  const [quick, setQuick] = useState(false);
  const [seed, setSeed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [addedToList, setAddedToList] = useState(false);

  const plan = useMemo(() => {
    if (!seed) return null;
    return buildPlan({ scope, diet, goal, budget, maxTime: quick ? 30 : null, occasion, people }, seed);
  }, [seed, scope, diet, goal, budget, quick, occasion, people]);
  const generated = plan?.meals ?? null;

  const generate = () => {
    setGenerating(true);
    setAddedToList(false);
    setTimeout(() => {
      setSeed(Date.now() % 100000);
      setGenerating(false);
    }, 700);
  };

  const addAllToList = () => {
    app.addToList(itemsFromRecipes([...new Set(generated)]));
    setAddedToList(true);
  };

  const prepDone = new Set([...PREP_DEFAULT_DONE, ...app.cooked]);
  const prepCount = PREP_BATCH.filter((p) => prepDone.has(p.id)).length;

  const genCost = generated ? generated.reduce((s, r) => s + r.costPerServing * people, 0) : 0;
  const genKcal = generated ? Math.round(generated.reduce((s, r) => s + r.kcal, 0) / generated.length) : 0;
  const genProtein = generated ? Math.round(generated.reduce((s, r) => s + r.protein, 0) / generated.length) : 0;

  return (
    <div className="pb-6 space-y-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Meal planner</h1>
        <p className="text-[13.5px] font-semibold rise rise-1" style={{ color: 'var(--muted)' }}>
          Tell the AI your constraints — it builds the plan and the shopping list.
        </p>
      </div>

      {/* Generator */}
      <Section className="rise rise-1">
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
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>People</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>incl. picky eaters</p>
            </div>
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
              className="w-full accent-[var(--accent)]"
              aria-label="Budget per serving"
            />
          </div>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Goal</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {PLANNER_GOALS.map((s) => <Chip key={s} active={goal === s} onClick={() => setGoal(s)}>{s}</Chip>)}
            </div>
          </div>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Diet & allergies</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {PLANNER_DIETS.map((s) => <Chip key={s} active={diet === s} onClick={() => setDiet(s)}>{s}</Chip>)}
            </div>
          </div>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Occasion</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {PLANNER_OCCASIONS.map((s) => <Chip key={s} active={occasion === s} onClick={() => setOccasion(s)}>{s}</Chip>)}
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
              {generating ? 'Thinking…' : seed ? 'Regenerate plan' : 'Generate plan'}
            </span>
          </button>
        </Card>
      </Section>

      {/* Generating skeleton */}
      {generating && (
        <Section title="Your plan">
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-2xl" />)}
          </div>
        </Section>
      )}

      {/* Generated result */}
      {generated && !generating && (
        <Section title={`Your ${scope.toLowerCase()} · ${occasion.toLowerCase()}`} className="rise">
          {plan.note && (
            <Card className="!p-3 mb-3 flex items-start gap-2" style={{ background: 'var(--card-2)' }}>
              <Info size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>{plan.note}</p>
            </Card>
          )}
          <Card className="!p-3 mb-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Estimated cost</p>
              <p className="text-[18px] font-extrabold">{gbp(genCost, { always: true })} <span className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>for {people}</span></p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Avg per meal</p>
              <p className="text-[14px] font-bold">{genKcal} kcal · {genProtein}g protein</p>
            </div>
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
                    {r.time} min · {gbp(r.costPerServing, { always: true })}/serving · {r.protein}g protein
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
              </Card>
            ))}
          </div>
          <button
            className="press mt-3 w-full rounded-2xl py-3 text-[14px] font-extrabold border disabled:opacity-60"
            style={addedToList
              ? { borderColor: 'var(--good)', color: 'var(--good)' }
              : { borderColor: 'var(--accent)', color: 'var(--accent)' }}
            onClick={addAllToList}
            disabled={addedToList}
          >
            <span className="inline-flex items-center gap-2">
              {addedToList
                ? <><Check size={15} strokeWidth={3} /> Missing ingredients added to Shop</>
                : <><ShoppingCart size={15} /> Add all ingredients to shopping list</>}
            </span>
          </button>
        </Section>
      )}

      {/* This week grid */}
      <Section title="This week" className="rise rise-2">
        <div className="space-y-2.5">
          {WEEK_DAYS.map((day) => {
            const slots = DEFAULT_PLAN[day];
            const meals = ['breakfast', 'lunch', 'dinner'].map((k) => (slots[k] ? byId(slots[k]) : null));
            const dayCost = meals.reduce((s, r) => s + (r ? r.costPerServing : 0), 0);
            return (
              <Card key={day} className="!p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-extrabold text-[14px]">{day}</p>
                  <Pill tone="muted">{gbp(dayCost, { always: true })}/person</Pill>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {meals.map((r, i) =>
                    r ? (
                      <button key={i} onClick={() => openRecipe(r)} className="press rounded-xl p-2 text-left" style={{ background: 'var(--card-2)' }}>
                        <Glyph e={r.emoji} size={18} style={{ color: 'var(--muted)' }} />
                        <p className="mt-1 text-[11px] font-bold leading-tight line-clamp-2">{r.name}</p>
                      </button>
                    ) : (
                      <div key={i} className="rounded-xl p-2 flex items-center justify-center text-[11px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--faint)' }}>
                        Leftovers
                      </div>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Meal prep progress */}
      <Section title="Meal prep progress" className="rise rise-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-[14px] flex items-center gap-1.5"><Snowflake size={14} /> Sunday batch session</p>
            <Pill tone="accent">{prepCount} of {PREP_BATCH.length} done</Pill>
          </div>
          <Meter value={prepCount} max={PREP_BATCH.length} />
          <p className="mt-2 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            {PREP_BATCH.map((p) => `${p.name}${prepDone.has(p.id) ? ' ✓' : ''}`).join(' · ')}
          </p>
        </Card>
      </Section>
    </div>
  );
}
