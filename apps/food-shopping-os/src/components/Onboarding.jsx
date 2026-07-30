import { useRef, useState } from 'react';
import {
  ArrowRight, Check, LayoutGrid, ShoppingCart, SlidersHorizontal,
  Upload, UtensilsCrossed, Users, Apple, Home,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { BODY_GOALS, DIET_PATTERNS, SEXES } from '../data/goals.js';
import { computeTargets, maintenanceFrom, targetsFor } from '../lib/goals.js';
import { byId } from '../data/recipes.js';
import { itemsFromRecipes } from '../data/stores.js';
import { PRODUCT } from '../data/product.js';
import { PRODUCT_MODES, resolveProductMode, DEFAULT_PRODUCT_MODE } from '../data/productModes.js';
import { addDays } from '../lib/kitchen.js';
import { haptic } from '../lib/haptics.js';
import { Card, Chip, FoodArt, Stepper, Toggle } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

const num = (value) => Math.max(0, Number(value) || 0) || null;

const MODE_ICONS = {
  meal_planning: UtensilsCrossed,
  shopping_budget: ShoppingCart,
  nutrition: Apple,
  household: Users,
  everything: LayoutGrid,
};

const STARTER_RECIPE_IDS = ['chicken-traybake', 'chickpea-curry', 'salmon-teriyaki'];

export default function Onboarding() {
  const app = useApp();
  const restoreRef = useRef(null);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [productMode, setProductMode] = useState(DEFAULT_PRODUCT_MODE);
  const [starterRecipeIds, setStarterRecipeIds] = useState([]);
  const [showPersonalisation, setShowPersonalisation] = useState(false);
  const [household, setHousehold] = useState(1);
  const [budget, setBudget] = useState('');
  const [diets, setDiets] = useState([]);
  const [goal, setGoal] = useState('maintain');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('unspecified');
  const [maintenance, setMaintenance] = useState('');
  const [trackCycle, setTrackCycle] = useState(false);

  const modeDef = resolveProductMode(productMode);
  const onboarding = modeDef.onboarding;

  const toggleDiet = (id) =>
    setDiets((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const body = {
    sex,
    age: num(age),
    heightCm: num(heightCm),
    weightKg: num(weightKg),
    activity: 'light',
  };
  const estimated = maintenanceFrom(body);

  const preview = computeTargets({
    goal,
    diets,
    maintenanceKcal: estimated || num(maintenance),
    weightKg: body.weightKg,
    fallbackKcal: DEFAULT_TARGETS.kcal,
  });

  const finish = () => {
    const starterRecipes = starterRecipeIds.map(byId).filter(Boolean);
    const starterPlan = Object.fromEntries(starterRecipes.map((recipe, index) => [
      addDays(app.day, index),
      { dinner: recipe.id },
    ]));
    const state = {
      goal,
      diets,
      body,
      maintenanceKcal: Math.max(0, Number(maintenance) || 0),
      targets: DEFAULT_TARGETS,
    };
    app.finishOnboarding({
      ...state,
      name: name.trim() || 'you',
      household,
      trackCycle,
      productMode,
      entryGoal: modeDef.entryGoal,
      starterRecipeIds,
      plan: starterPlan,
      shoppingList: itemsFromRecipes(starterRecipes),
      weeklyBudget: Math.max(0, Number(budget) || 0),
      targets: targetsFor(state),
    });
    haptic();
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = app.restoreData(await file.text());
    setRestoreStatus(result.ok ? 'Backup restored.' : result.error);
  };

  // Nutrition mode opens personalisation by default; others keep it optional.
  const nutritionOpen = showPersonalisation || (onboarding.showNutrition && step === 2);

  return (
    <div className="mx-auto max-w-lg min-h-screen px-5 pt-16 pb-10" style={{ background: 'var(--bg)' }}>
      <div className="rise">
        <UtensilsCrossed size={30} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
        <h1 className="mt-3 text-[1.75rem] font-extrabold tracking-tight leading-tight">
          {step === 0 ? 'Welcome to Forq' : step === 1 ? 'A little context' : 'Your first win'}
        </h1>
        <p className="mt-1.5 text-[0.875rem] font-semibold" style={{ color: 'var(--muted)' }}>
          {step === 0 && (
            <>
              <span className="block font-extrabold" style={{ color: 'var(--ink)' }}>{PRODUCT.promise}</span>
              <span className="mt-1.5 block">
                Choose what you mainly need. Everything else stays available — this only simplifies the surfaces you see first.
              </span>
            </>
          )}
          {step === 1 && (
            onboarding.showBudget || onboarding.showHousehold || onboarding.showDiets
              ? 'Optional details for your mode. Skip anything you do not need yet.'
              : 'Almost ready — continue for your first win, or skip optional context.'
          )}
          {step === 2 && (
            onboarding.showStarters
              ? 'Pick up to three recipes. Forq puts them on the plan and builds one shopping list.'
              : onboarding.showNutrition
                ? 'Optional targets and body metrics so the diary has numbers to measure against.'
                : 'You can start empty and fill the kitchen when you are ready.'
          )}
        </p>
      </div>

      <div className="mt-6 space-y-4 rise rise-1">
        {step === 0 && (
          <>
            <fieldset>
              <legend className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                What do you mainly need?
              </legend>
              <div className="mt-2 grid gap-2.5">
                {PRODUCT_MODES.map(({ id, label, blurb }) => {
                  const Icon = MODE_ICONS[id] || Home;
                  const selected = productMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setProductMode(id)}
                      className="press flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left"
                      style={{
                        background: selected ? 'var(--accent-soft)' : 'var(--card)',
                        borderColor: selected ? 'var(--accent)' : 'var(--line)',
                      }}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: selected ? 'var(--accent)' : 'var(--card-2)',
                          color: selected ? 'var(--on-accent)' : 'var(--muted)',
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] font-extrabold">{label}</span>
                        <span className="block text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>{blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Card className="space-y-3">
              <label className="block">
                <span className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                  What should we call you? <span className="normal-case tracking-normal">(optional)</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
                  placeholder="Your name"
                  aria-label="Your name"
                  autoFocus
                  className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-[0.9375rem] font-semibold outline-none"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                />
              </label>
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            {onboarding.showHousehold && (
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[0.875rem]">People you cook for</p>
                  <p className="text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>Including you</p>
                </div>
                <Stepper value={household} onChange={setHousehold} min={1} max={10} />
              </Card>
            )}
            {onboarding.showBudget && (
              <Card>
                <NumberField
                  label="Weekly food budget"
                  value={budget}
                  onChange={setBudget}
                  suffix="£"
                  step={5}
                />
                <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Leave it at 0 if you&rsquo;d rather not track spending.
                </p>
              </Card>
            )}
            {onboarding.showDiets && (
              <Card>
                <p className="text-[0.6875rem] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                  How you eat
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIET_PATTERNS.map((d) => (
                    <Chip key={d.id} active={diets.includes(d.id)} onClick={() => toggleDiet(d.id)}>{d.label}</Chip>
                  ))}
                </div>
                <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Pick any that apply, or none. They filter recipes and shape your macro split.
                </p>
              </Card>
            )}
            {!onboarding.showHousehold && !onboarding.showBudget && !onboarding.showDiets && (
              <Card>
                <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  {modeDef.label} keeps setup light. You can add household size, budget and diets later under Preferences.
                </p>
              </Card>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {onboarding.showStarters && (
              <fieldset>
                <legend className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                  Choose up to three dinners
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {STARTER_RECIPE_IDS.map((id) => {
                    const recipe = byId(id);
                    const selected = starterRecipeIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setStarterRecipeIds((current) =>
                          current.includes(id)
                            ? current.filter((recipeId) => recipeId !== id)
                            : current.length < 3 ? [...current, id] : current)}
                        className="press overflow-hidden rounded-2xl border text-left"
                        style={{
                          background: 'var(--card)',
                          borderColor: selected ? 'var(--accent)' : 'var(--line)',
                          boxShadow: selected ? '0 0 0 1px var(--accent)' : 'none',
                        }}
                      >
                        <FoodArt recipe={recipe} className="h-24 w-full" px={28} />
                        <span className="block p-2.5">
                          <span className="block text-[0.75rem] font-extrabold leading-tight">{recipe.name}</span>
                          <span className="mt-1 block text-[0.65625rem] font-semibold" style={{ color: 'var(--muted)' }}>
                            {recipe.time} min · £{recipe.costPerServing.toFixed(2)}/serving
                          </span>
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[0.65625rem] font-extrabold" style={{ color: selected ? 'var(--accent)' : 'var(--faint)' }}>
                            {selected && <Check size={11} strokeWidth={3} />}
                            {selected ? 'Selected' : 'Choose'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Optional. Choose nothing to start with an empty app.
                </p>
              </fieldset>
            )}

            {!onboarding.showNutrition && (
              <button
                type="button"
                onClick={() => setShowPersonalisation((value) => !value)}
                aria-expanded={showPersonalisation}
                className="press flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
                style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
              >
                <span>
                  <span className="block text-[0.84375rem] font-extrabold">Personalise nutrition</span>
                  <span className="block text-[0.71875rem] font-semibold" style={{ color: 'var(--muted)' }}>Optional goals, body metrics and cycle tracking</span>
                </span>
                <SlidersHorizontal size={17} style={{ color: 'var(--muted)' }} />
              </button>
            )}

            {nutritionOpen && (
              <>
                <div>
                  <p className="text-[0.6875rem] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                    What are you aiming for?
                  </p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {BODY_GOALS.map((g) => (
                      <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>{g.label}</Chip>
                    ))}
                  </div>
                  <p className="mt-2 text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                    {BODY_GOALS.find((g) => g.id === goal).blurb}
                  </p>
                </div>

                <Card className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumberField label="Your weight" value={weightKg} onChange={setWeightKg} suffix="kg" step={0.5} />
                    <NumberField label="Your height" value={heightCm} onChange={setHeightCm} suffix="cm" step={1} />
                    <NumberField label="Age" value={age} onChange={setAge} suffix="yrs" step={1} />
                    <div>
                      <span className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Sex</span>
                      <div className="mt-1 flex gap-1.5 overflow-x-auto no-scrollbar">
                        {SEXES.map((s) => (
                          <Chip key={s.id} active={sex === s.id} onClick={() => setSex(s.id)}>{s.label}</Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                  {estimated ? (
                    <p className="text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                      That estimates your maintenance at <strong>{estimated.toLocaleString()} kcal</strong>
                      {' '}(Mifflin-St Jeor, lightly active). Change the activity level under Goals any time.
                    </p>
                  ) : (
                    <NumberField label="Maintenance" value={maintenance} onChange={setMaintenance} suffix="kcal" step={50} />
                  )}
                </Card>
                <p className="text-[0.75rem] font-semibold px-1 -mt-1" style={{ color: 'var(--muted)' }}>
                  All optional. Weight, height, age and sex together let Forq estimate your maintenance
                  instead of you knowing it — sex matters because the equation&rsquo;s constants differ by
                  166 kcal, which is a meal. &ldquo;Rather not say&rdquo; takes the midpoint rather than
                  picking one for you, and every field is editable later.
                </p>

                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[0.875rem]">Track your cycle</p>
                      <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                        Adds a page under Health for periods and symptoms
                      </p>
                    </div>
                    <Toggle label="Track your cycle" on={trackCycle} onChange={() => setTrackCycle(!trackCycle)} />
                  </div>
                  <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                    Off by default, and nothing else changes either way. Turn it on or off whenever you
                    like under Goals.
                  </p>
                </Card>

                <Card>
                  <p className="text-[0.6875rem] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                    That works out as
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[1.875rem] font-extrabold leading-none">{preview.kcal.toLocaleString()}</p>
                      <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>kcal a day</p>
                    </div>
                    <div className="flex gap-4 text-right">
                      {[['Protein', preview.protein], ['Carbs', preview.carbs], ['Fat', preview.fat]].map(([label, v]) => (
                        <div key={label}>
                          <p className="text-[0.9375rem] font-extrabold leading-none">{v}g</p>
                          <p className="text-[0.65625rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                <p className="text-[0.75rem] font-semibold px-1" style={{ color: 'var(--muted)' }}>
                  Vitamins and minerals start at UK reference intakes. Everything here is editable later.
                </p>
              </>
            )}

            {!onboarding.showStarters && !nutritionOpen && (
              <Card>
                <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                  Start empty and add pantry items, plans or diary entries when you are ready.
                  Product mode only changes what shows first — nothing is locked away.
                </p>
              </Card>
            )}
          </>
        )}
      </div>

      <div className="mt-8 flex gap-2.5 rise rise-2">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="press rounded-2xl border px-5 py-3.5 font-extrabold"
            style={{ borderColor: 'var(--line)' }}
          >
            Back
          </button>
        )}
        <button
          onClick={() => (step === 2 ? finish() : setStep(step + 1))}
          className="press flex-1 rounded-2xl py-3.5 text-[0.9375rem] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-2">
            {step === 2 ? <><Check size={16} strokeWidth={3} /> Start using Forq</> : <>Continue <ArrowRight size={16} /></>}
          </span>
        </button>
      </div>

      {step === 0 && (
        <div className="mt-4 text-center">
          <button
            className="press px-4 py-2 text-[0.78125rem] font-bold"
            style={{ color: 'var(--muted)' }}
            onClick={() => restoreRef.current?.click()}
          >
            <span className="inline-flex items-center gap-1.5"><Upload size={14} /> Restore an existing backup</span>
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Restore Forq backup"
            onChange={restore}
          />
          {restoreStatus && <p role="status" className="mt-1 text-[0.75rem] font-semibold">{restoreStatus}</p>}
        </div>
      )}

      <div className="mt-5 flex justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === step ? 22 : 8, background: i === step ? 'var(--accent)' : 'var(--line)' }}
          />
        ))}
      </div>
    </div>
  );
}
