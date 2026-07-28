import { Check } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { setupProgress } from '../lib/setup.js';
import { Card, Meter } from './ui.jsx';

/**
 * The getting-started card, on Home until it's finished.
 *
 * Every row is something a feature is genuinely waiting on, so ticking one
 * turns a page on somewhere else rather than earning a tick. It disappears
 * entirely when it's done — a checklist that lingers at 6/6 is furniture.
 */
export default function GettingStarted({ goTab }) {
  const app = useApp();
  const { steps, done, total, pct, complete, next } = setupProgress(app);
  if (complete) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-extrabold text-[15px]">Getting started</p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            {done} of {total} — each one switches something on
          </p>
        </div>
        <p className="text-[13px] font-extrabold shrink-0" style={{ color: 'var(--accent)' }}>{pct}%</p>
      </div>
      <Meter value={done} max={total} />

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => !s.done && goTab(s.go)}
              disabled={s.done}
              className="press flex w-full items-start gap-2.5 rounded-2xl p-2 text-left disabled:opacity-100"
              style={{ background: s.id === next?.id ? 'var(--card-2)' : 'transparent' }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={s.done
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
                  : { borderColor: 'var(--line)' }}
              >
                {s.done && <Check className="check-in" size={12} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[13.5px] font-bold"
                  style={{ color: s.done ? 'var(--faint)' : 'var(--ink)', textDecoration: s.done ? 'line-through' : 'none' }}
                >
                  {s.label}
                </span>
                {!s.done && (
                  <span className="block text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>{s.why}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* No button down here: the next step is the screen's primary action,
          sitting at the bottom of the phone where your thumb already is. */}
    </Card>
  );
}
