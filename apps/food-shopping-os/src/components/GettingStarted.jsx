import { ArrowRight } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { setupProgress } from '../lib/setup.js';
import { Card } from './ui.jsx';

const GOAL_ORDER = {
  plan: ['plan', 'cook', 'pantry', 'shop', 'log', 'targets'],
  shop: ['shop', 'pantry', 'plan', 'cook', 'log', 'targets'],
  pantry: ['pantry', 'plan', 'cook', 'shop', 'log', 'targets'],
};

export const contextualSetupStep = (app, steps) => {
  const order = GOAL_ORDER[app.entryGoal] || GOAL_ORDER.plan;
  const available = steps.filter((step) => !step.done && !app.dismissedSetupSteps.includes(step.id));
  return [...available].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0] || null;
};

export default function GettingStarted({ goTab, openPantry }) {
  const app = useApp();
  const { steps, done, total, complete } = setupProgress(app);
  const next = contextualSetupStep(app, steps);
  if (complete || !next) return null;

  const act = () => {
    if (next.id === 'pantry') openPantry();
    else goTab(next.go);
  };

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
            Suggested next · {done} of {total} complete
          </p>
          <p className="mt-1 text-[16px] font-extrabold tracking-tight">{next.label}</p>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
            {next.why}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <ArrowRight size={16} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={act}
          className="press rounded-xl px-3.5 py-2.5 text-[12.5px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          {next.label}
        </button>
        <button
          onClick={() => app.dismissSetupStep(next.id)}
          className="tap press text-[12px] font-bold"
          style={{ color: 'var(--muted)' }}
        >
          Not now
        </button>
      </div>
    </Card>
  );
}
