import { useState } from 'react';
import { ArrowRight, Check, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { BODY_GOALS, DIET_PATTERNS, SEXES } from '../data/goals.js';
import { computeTargets, maintenanceFrom, targetsFor } from '../lib/goals.js';
import { Card, Chip, Stepper, Toggle } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

const num = (value) => Math.max(0, Number(value) || 0) || null;

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
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

  const toggleDiet = (id) =>
    setDiets((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const body = {
    sex,
    age: num(age),
    heightCm: num(heightCm),
    weightKg: num(weightKg),
    activity: 'light',
  };
  // With weight, height and age, the equation runs; without, we fall back to
  // whatever figure you typed, and with neither to the default.
  const estimated = maintenanceFrom(body);

  /** Whatever we know: the estimate, a typed figure, or the default. */
  const preview = computeTargets({
    goal,
    diets,
    maintenanceKcal: estimated || num(maintenance),
    weightKg: body.weightKg,
    fallbackKcal: DEFAULT_TARGETS.kcal,
  });

  const finish = () => {
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
      weeklyBudget: Math.max(0, Number(budget) || 0),
      targets: targetsFor(state),
    });
  };

  return (
    <div className="mx-auto max-w-lg min-h-screen px-5 pt-16 pb-10" style={{ background: 'var(--bg)' }}>
      <div className="rise">
        <UtensilsCrossed size={30} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
        <h1 className="mt-3 text-[28px] font-extrabold tracking-tight leading-tight">
          {step === 0 ? 'Welcome to Forq' : step === 1 ? 'Your kitchen' : 'Your targets'}
        </h1>
        <p className="mt-1.5 text-[14px] font-semibold" style={{ color: 'var(--muted)' }}>
          {step === 0 && 'Plan meals, shop smarter, cook better. Everything you see will be built from what you actually log — nothing is filled in for you.'}
          {step === 1 && 'Used for budget headroom and recipe portions. Both are editable later.'}
          {step === 2 && 'A starting point for the diary. Every nutrient target can be changed any time.'}
        </p>
      </div>

      <div className="mt-6 space-y-4 rise rise-1">
        {step === 0 && (
          <Card className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                What should we call you?
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
                placeholder="Your name"
                aria-label="Your name"
                autoFocus
                className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-[15px] font-semibold outline-none"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />
            </label>
          </Card>
        )}

        {step === 1 && (
          <>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[14px]">People you cook for</p>
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>Including you</p>
              </div>
              <Stepper value={household} onChange={setHousehold} min={1} max={10} />
            </Card>
            <Card>
              <NumberField
                label="Weekly food budget"
                value={budget}
                onChange={setBudget}
                suffix="£"
                step={5}
              />
              <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                Leave it at 0 if you'd rather not track spending.
              </p>
            </Card>
            <Card>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                How you eat
              </p>
              <div className="flex flex-wrap gap-2">
                {DIET_PATTERNS.map((d) => (
                  <Chip key={d.id} active={diets.includes(d.id)} onClick={() => toggleDiet(d.id)}>{d.label}</Chip>
                ))}
              </div>
              <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                Pick any that apply, or none. They filter recipes and shape your macro split.
              </p>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                What are you aiming for?
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {BODY_GOALS.map((g) => (
                  <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>{g.label}</Chip>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                {BODY_GOALS.find((g) => g.id === goal).blurb}
              </p>
            </div>

            <Card className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField label="Your weight" value={weightKg} onChange={setWeightKg} suffix="kg" step={0.5} />
                <NumberField label="Your height" value={heightCm} onChange={setHeightCm} suffix="cm" step={1} />
                <NumberField label="Age" value={age} onChange={setAge} suffix="yrs" step={1} />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Sex</span>
                  <div className="mt-1 flex gap-1.5 overflow-x-auto no-scrollbar">
                    {SEXES.map((s) => (
                      <Chip key={s.id} active={sex === s.id} onClick={() => setSex(s.id)}>{s.label}</Chip>
                    ))}
                  </div>
                </div>
              </div>
              {estimated ? (
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                  That estimates your maintenance at <strong>{estimated.toLocaleString()} kcal</strong>
                  {' '}(Mifflin-St Jeor, lightly active). Change the activity level under Goals any time.
                </p>
              ) : (
                <NumberField label="Maintenance" value={maintenance} onChange={setMaintenance} suffix="kcal" step={50} />
              )}
            </Card>
            <p className="text-[12px] font-semibold px-1 -mt-1" style={{ color: 'var(--muted)' }}>
              All optional. Weight, height, age and sex together let Forq estimate your maintenance
              instead of you knowing it — sex matters because the equation&rsquo;s constants differ by
              166 kcal, which is a meal. &ldquo;Rather not say&rdquo; takes the midpoint rather than
              picking one for you, and every field is editable later.
            </p>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[14px]">Track your cycle</p>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    Adds a page under Health for periods and symptoms
                  </p>
                </div>
                <Toggle label="Track your cycle" on={trackCycle} onChange={() => setTrackCycle(!trackCycle)} />
              </div>
              <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                Off by default, and nothing else changes either way. Turn it on or off whenever you
                like under Goals.
              </p>
            </Card>

            <Card>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>
                That works out as
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[30px] font-extrabold leading-none">{preview.kcal.toLocaleString()}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>kcal a day</p>
                </div>
                <div className="flex gap-4 text-right">
                  {[['Protein', preview.protein], ['Carbs', preview.carbs], ['Fat', preview.fat]].map(([label, v]) => (
                    <div key={label}>
                      <p className="text-[15px] font-extrabold leading-none">{v}g</p>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <p className="text-[12px] font-semibold px-1" style={{ color: 'var(--muted)' }}>
              Vitamins and minerals start at UK reference intakes. Everything here is editable later.
            </p>
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
          className="press flex-1 rounded-2xl py-3.5 text-[15px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <span className="inline-flex items-center gap-2">
            {step === 2 ? <><Check size={16} strokeWidth={3} /> Start using Forq</> : <>Continue <ArrowRight size={16} /></>}
          </span>
        </button>
      </div>

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
