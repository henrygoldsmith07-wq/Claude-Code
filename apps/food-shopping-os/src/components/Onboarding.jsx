import { useRef, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, LayoutGrid, ShoppingCart,
  Upload, UtensilsCrossed, Users, Apple, Home,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { DIET_PATTERNS } from '../data/goals.js';
import { targetsFor } from '../lib/goals.js';
import { PRODUCT } from '../data/product.js';
import { PRODUCT_MODES, resolveProductMode, DEFAULT_PRODUCT_MODE } from '../data/productModes.js';
import { haptic } from '../lib/haptics.js';
import { Card, Chip, Stepper } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

/**
 * Three-stage setup model (only stage 1 blocks the door):
 *
 *   Required — name, household size, main goal (product mode)
 *   Useful later — diets, weekly budget (skippable; soft prompt in-app)
 *   Optional advanced — body, targets, health, cycle (Goals / Add tools later)
 *
 * Users can start planning as soon as required fields are done.
 */

const MODE_ICONS = {
  meal_planning: UtensilsCrossed,
  shopping_budget: ShoppingCart,
  nutrition: Apple,
  household: Users,
  everything: LayoutGrid,
};

export default function Onboarding() {
  const app = useApp();
  const restoreRef = useRef(null);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [name, setName] = useState('');
  const [productMode, setProductMode] = useState(DEFAULT_PRODUCT_MODE);
  const [household, setHousehold] = useState(1);
  const [showUseful, setShowUseful] = useState(false);
  const [budget, setBudget] = useState('');
  const [diets, setDiets] = useState([]);

  const modeDef = resolveProductMode(productMode);

  const toggleDiet = (id) =>
    setDiets((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const finish = () => {
    const weeklyBudget = Math.max(0, Number(budget) || 0);
    const usefulDone = diets.length > 0 || weeklyBudget > 0;
    const state = {
      goal: 'maintain',
      diets,
      body: { sex: 'unspecified', age: null, heightCm: null, weightKg: null, activity: 'light' },
      maintenanceKcal: 0,
      targets: DEFAULT_TARGETS,
    };
    app.finishOnboarding({
      ...state,
      name: name.trim() || 'you',
      household,
      productMode,
      entryGoal: modeDef.entryGoal,
      weeklyBudget,
      targets: targetsFor(state),
      // Soft stage-2 prompt until diets/budget filled or dismissed
      usefulSetupPending: !usefulDone,
      // Starters empty — plan on Plan tab / week loop, not during signup
      starterRecipeIds: [],
      plan: {},
      shoppingList: [],
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

  return (
    <div className="mx-auto max-w-lg min-h-screen px-5 pt-16 pb-10" style={{ background: 'var(--bg)' }}>
      <div className="rise">
        <UtensilsCrossed size={30} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
        <h1 className="mt-3 text-[1.75rem] font-extrabold tracking-tight leading-tight">
          Welcome to Forq
        </h1>
        <p className="mt-1.5 text-[0.875rem] font-semibold" style={{ color: 'var(--muted)' }}>
          <span className="block font-extrabold" style={{ color: 'var(--ink)' }}>{PRODUCT.promise}</span>
          <span className="mt-1.5 block">
            Three things to start. Everything else can wait until you need it.
          </span>
        </p>
      </div>

      <div className="mt-6 space-y-4 rise rise-1">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
          Required
        </p>

        <Card className="space-y-3">
          <label className="block">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Your name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              aria-label="Your name"
              autoFocus
              className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-[0.9375rem] font-semibold outline-none"
              style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
          </label>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[0.875rem]">Household size</p>
            <p className="text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>
              People you cook for, including you
            </p>
          </div>
          <Stepper value={household} onChange={setHousehold} min={1} max={10} />
        </Card>

        <fieldset>
          <legend className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
            Main goal
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

        {/* Useful later — collapsed, never required */}
        <button
          type="button"
          onClick={() => setShowUseful((v) => !v)}
          aria-expanded={showUseful}
          className="press flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
          style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
        >
          <span>
            <span className="block text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Useful later
            </span>
            <span className="block text-[0.84375rem] font-extrabold">Diet & weekly budget</span>
            <span className="block text-[0.71875rem] font-semibold" style={{ color: 'var(--muted)' }}>
              Optional — add now or from Preferences
            </span>
          </span>
          <ChevronDown
            size={18}
            style={{
              color: 'var(--muted)',
              transform: showUseful ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.15s',
            }}
          />
        </button>

        {showUseful && (
          <>
            <Card>
              <NumberField
                label="Weekly food budget"
                value={budget}
                onChange={setBudget}
                suffix="£"
                step={5}
              />
              <p className="mt-2 text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
                Leave blank if you&rsquo;d rather not track spending yet.
              </p>
            </Card>
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
                Filters recipes. Skip if you&rsquo;re not sure.
              </p>
            </Card>
          </>
        )}

        <Card className="!p-3.5">
          <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
            Optional advanced
          </p>
          <p className="mt-1 text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>
            Body measurements, nutrition targets, health and cycle tracking stay under Goals and Add tools — after you&rsquo;ve planned a meal.
          </p>
        </Card>
      </div>

      <div className="mt-8 rise rise-2">
        <button
          type="button"
          onClick={finish}
          className="press w-full rounded-2xl py-3.5 text-[0.9375rem] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-2">
            <Check size={16} strokeWidth={3} />
            Start planning
            <ArrowRight size={16} />
          </span>
        </button>
        <p className="mt-2 text-center text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
          You can plan meals straight away. Finish settings whenever you like.
        </p>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
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
    </div>
  );
}
