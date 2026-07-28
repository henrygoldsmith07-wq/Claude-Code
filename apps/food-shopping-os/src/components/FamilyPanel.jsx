import { useState } from 'react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { DIET_PATTERNS } from '../data/goals.js';
import { Card, Chip, Pill, Stepper } from './ui.jsx';

/**
 * Who you cook for.
 *
 * A household is not one appetite and one diet. Each person carries their own
 * portion size and their own dietary patterns; the planner adds the portions up
 * and takes the union of the patterns, so a plan that suits one vegetarian
 * suits the whole table. Nobody is here until you add them.
 */
export default function FamilyPanel() {
  const app = useApp();
  const [name, setName] = useState('');

  const add = () => {
    app.addMember({ name, portions: 1, diets: [] });
    setName('');
  };

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card>
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Cooking for</p>
        <p className="mt-0.5 text-[15px] font-extrabold">
          {app.members.length
            ? `${app.members.length} ${app.members.length === 1 ? 'person' : 'people'} · ${app.portions} portion${app.portions === 1 ? '' : 's'} a meal`
            : `Just you · ${app.portions} portion${app.portions === 1 ? '' : 's'} a meal`}
        </p>
        <p className="mt-1 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          {app.planDiets.length
            ? `Plans avoid: ${app.planDiets.join(' · ')}.`
            : 'No dietary patterns between you — every dish is on the table.'}
        </p>
      </Card>

      <div className="space-y-2.5">
        {app.members.map((m) => (
          <Card key={m.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                value={m.name}
                onChange={(e) => app.updateMember(m.id, { name: e.target.value })}
                aria-label={`Name for ${m.name}`}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-[14px] font-bold outline-none"
                style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />
              <button
                onClick={() => app.removeMember(m.id)}
                aria-label={`Remove ${m.name}`}
                className="press flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: 'var(--card-2)', color: 'var(--muted)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Portions</p>
              <Stepper value={m.portions} onChange={(v) => app.updateMember(m.id, { portions: v })} min={1} max={4} />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Eats</p>
              <div className="flex flex-wrap gap-2">
                {DIET_PATTERNS.filter((d) => d.kind !== 'macro').map((d) => (
                  <Chip
                    key={d.id}
                    active={m.diets.includes(d.id)}
                    onClick={() => app.toggleMemberDiet(m.id, d.id)}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="space-y-2.5">
        <p className="text-[12px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
          <Users size={13} /> Add someone
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Name"
            aria-label="New household member"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            onClick={add}
            className="press rounded-xl px-4 text-[13px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <span className="inline-flex items-center gap-1.5"><UserPlus size={14} /> Add</span>
          </button>
        </div>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
          Portions scale the plan's cost and the shopping list. <Pill tone="muted">no invented people</Pill>
        </p>
      </Card>
    </div>
  );
}
