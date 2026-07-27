import { useState } from 'react';
import { ArrowRight, Check, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { PLANNER_DIETS } from '../data/plan.js';
import { Card, Chip, Stepper } from './ui.jsx';
import { NumberField } from './FoodDetail.jsx';

/**
 * Energy targets by intent. Protein/carb/fat splits follow the goal rather
 * than a one-size default, and every one of them stays editable afterwards.
 */
const GOALS = [
  { id: 'maintain', label: 'Eat well', kcal: 2200, protein: 110, carbs: 260, fat: 75 },
  { id: 'lose', label: 'Lose weight', kcal: 1800, protein: 130, carbs: 170, fat: 60 },
  { id: 'gain', label: 'Build muscle', kcal: 2700, protein: 160, carbs: 300, fat: 85 },
  { id: 'custom', label: 'Set my own', kcal: 2200, protein: 130, carbs: 250, fat: 75 },
];

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [household, setHousehold] = useState(1);
  const [budget, setBudget] = useState('');
  const [diet, setDiet] = useState('None');
  const [goalId, setGoalId] = useState('maintain');
  const [macros, setMacros] = useState(GOALS[0]);

  const pickGoal = (goal) => {
    setGoalId(goal.id);
    setMacros(goal);
  };

  const finish = () => {
    app.finishOnboarding({
      name: name.trim() || 'you',
      household,
      diet,
      weeklyBudget: Math.max(0, Number(budget) || 0),
      targets: {
        ...DEFAULT_TARGETS,
        kcal: Math.max(0, Number(macros.kcal) || DEFAULT_TARGETS.kcal),
        protein: Math.max(0, Number(macros.protein) || DEFAULT_TARGETS.protein),
        carbs: Math.max(0, Number(macros.carbs) || DEFAULT_TARGETS.carbs),
        fat: Math.max(0, Number(macros.fat) || DEFAULT_TARGETS.fat),
      },
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
                Diet
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {PLANNER_DIETS.map((d) => (
                  <Chip key={d} active={diet === d} onClick={() => setDiet(d)}>{d}</Chip>
                ))}
              </div>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {GOALS.map((g) => (
                <Chip key={g.id} active={goalId === g.id} onClick={() => pickGoal(g)}>{g.label}</Chip>
              ))}
            </div>
            <Card className="grid grid-cols-2 gap-2.5">
              <NumberField label="Calories" value={macros.kcal} onChange={(v) => setMacros((m) => ({ ...m, kcal: v }))} suffix="kcal" step={50} />
              <NumberField label="Protein" value={macros.protein} onChange={(v) => setMacros((m) => ({ ...m, protein: v }))} suffix="g" step={5} />
              <NumberField label="Carbs" value={macros.carbs} onChange={(v) => setMacros((m) => ({ ...m, carbs: v }))} suffix="g" step={5} />
              <NumberField label="Fat" value={macros.fat} onChange={(v) => setMacros((m) => ({ ...m, fat: v }))} suffix="g" step={5} />
            </Card>
            <p className="text-[12px] font-semibold px-1" style={{ color: 'var(--muted)' }}>
              Vitamins and minerals start at UK reference intakes — adjust them in the diary whenever you like.
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
